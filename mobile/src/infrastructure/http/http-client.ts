import { Platform } from 'react-native'
import { Result } from '../../domain/shared/result.js'
import { telemetry } from '../telemetry/telemetry.js'
import { authClient } from '../auth/auth-client.js'
import { queryClient } from '../../application/shared/query-client.js'
import type { ApiError } from '../../domain/shared/api-error.js'

const API_URL = process.env.EXPO_PUBLIC_API_URL as string

/** Names the span/log with the business action it belongs to, and carries whatever entity ids the caller already knows — never free text. */
export interface ActionContext {
  action?: string
  attributes?: Record<string, string | number | boolean>
}

/**
 * The backend revoking a session mid-visit (cookie expired, signed out
 * elsewhere, server restarted with in-memory sessions) used to leave the app
 * stuck between two states forever: every protected call now 401s, but
 * nothing ever told the `(tabs)`/`(auth)` gates — both read `useSessionQuery`
 * off TanStack's cache, which nothing here refetches on its own (no
 * `AppState`/`focusManager` wiring, and the screens that hold it never
 * remount) — so `session.data` stayed the last *truthy* answer from cold
 * start and the app went on rendering protected screens against a session
 * the server had already thrown away. Not signed in, not signed out either.
 *
 * `requireAuthenticatedUser` on the backend (see `auth-context.ts`) throws
 * exactly one shape for this — `{ type: 'unauthenticated' }` — deliberately
 * distinct from `invalid_credentials` (a rejected sign-in attempt, which
 * never reaches here: it goes through `authClient.signIn.email`, not this
 * module), so this only fires for a session that *was* valid and just died.
 */
function handleUnauthenticated() {
  // Flips every gate and query reading `useSessionQuery()` to "signed out"
  // immediately — no need to re-ask the backend to confirm what it just
  // said. `(tabs)/_layout.tsx` redirects to `/(auth)/sign-in` on its next
  // render once `session.data` is `null`.
  queryClient.setQueryData(['session'], null)
  // Best-effort: also drops the now-dead cookie from SecureStore, so later
  // requests stop sending it. The gate flip above doesn't depend on this.
  authClient.signOut().catch(() => {})
}

/**
 * Wraps one outgoing call in a client span and injects `traceparent`, so the
 * span the backend opens for the same request is a child of this one. That
 * single header is the whole mobile→backend correlation mechanism: no custom
 * id, no custom protocol, just W3C trace context.
 *
 * Telemetry is entirely out of the request's way — `startClientSpan` returns
 * `null` when it is off, and `end()` cannot throw — so a missing or broken
 * observability stack changes nothing about what this function returns.
 */
async function tracedFetch(
  path: string,
  method: string,
  init: RequestInit,
  context?: ActionContext,
): Promise<{ response: Response; span: ReturnType<typeof telemetry.startClientSpan> }> {
  const span = telemetry.startClientSpan(context?.action ?? `${method} ${path}`, {
    'http.request.method': method,
    // The path, never the query string: it is where ids and search terms live.
    'url.path': path.split('?')[0],
    'server.address': API_URL,
    ...context?.attributes,
  })

  // React Native's `fetch` keeps no cookie jar across requests — unlike a
  // browser, `credentials: 'include'` alone sends nothing here. better-auth's
  // Expo plugin stores the session cookie itself (SecureStore) exactly for
  // this reason, and `getCookie()` is the documented way to read it back for
  // any request that doesn't go through `authClient`'s own fetch. Without
  // this, every call below is unauthenticated on native, no matter how
  // recently the user signed in.
  //
  // Web never needed this: the browser's own cookie jar already attaches the
  // session cookie via `credentials: 'include'` below. It matters more than
  // "unneeded" — `expo-secure-store`'s web shim doesn't implement
  // `getValueWithKeyAsync` at all, so calling `getCookie()` here on web threw
  // on every single request, silently failing every `apiFetch` call.
  const cookie = Platform.OS === 'web' ? null : await authClient.getCookie()

  const headers = {
    ...(init.headers as Record<string, string>),
    ...(span ? { traceparent: span.traceparent } : null),
    ...(cookie ? { Cookie: cookie } : null),
  }

  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, headers })
    span?.end({ attributes: { 'http.response.status_code': response.status } })
    return { response, span }
  } catch (error) {
    span?.end({ error })
    // A transport failure never reaches the backend, so this is the only
    // trace of it anywhere — and it must not depend on telemetry being
    // configured. `recordError` below only fires when `span` is non-null
    // (telemetry off/unconfigured, the common case in local dev, returns
    // `null` from `startClientSpan`), which used to mean a dev running
    // without a telemetry relay saw absolutely nothing for a request that
    // never left the device — not even in the Metro console. This one
    // always prints, telemetry or not.
    console.error(`[api] ${method} ${path} failed before reaching the server`, error)
    if (span) {
      telemetry.recordError(`${method} ${path} failed before reaching the server`, {
        error,
        span,
        attributes: { 'http.request.method': method, 'url.path': path.split('?')[0] },
      })
    }
    throw error
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  context?: ActionContext,
): Promise<Result<T, ApiError>> {
  try {
    const { response, span } = await tracedFetch(
      path,
      init?.method ?? 'GET',
      {
        ...init,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...init?.headers },
      },
      context,
    )
    // A 204 always means "success, no body" — nothing to parse.
    if (response.status === 204) return Result.ok(undefined as T)
    const body = await response.json()
    if (!response.ok) {
      const error = body.error as ApiError
      // The request reached the backend, so this is not a transport failure
      // — `tracedFetch` already ended the span as "success" with the status
      // code attached, which used to leave every 4xx/5xx business error
      // invisible in traces. Recorded here instead of restructuring the
      // span's timing above.
      telemetry.recordError(`action failed: ${error.type}`, {
        attributes: { 'error.type': error.type, action: context?.action ?? `${init?.method ?? 'GET'} ${path}` },
        ...(span ? { span } : null),
      })
      if (error.type === 'unauthenticated') handleUnauthenticated()
      return Result.err(error)
    }
    return Result.ok(body as T)
  } catch (error) {
    // Covers two cases: `tracedFetch` already logged a pure transport
    // failure (this just adds the "here's the generic error the caller
    // sees" breadcrumb next to it); a *successful* response whose body
    // wasn't valid JSON never gets logged anywhere else at all.
    console.error(`[api] ${init?.method ?? 'GET'} ${path} could not be completed`, error)
    return Result.err({ type: 'network_error', message: 'Impossible de contacter le serveur.' })
  }
}

/**
 * Like `apiFetch`, but for a `FormData` body (the one client→server call
 * that isn't JSON: the receipt-scan image upload). No `Content-Type`
 * header is set — `fetch` derives the multipart boundary from the
 * `FormData` instance itself, and setting it manually would drop that
 * boundary.
 */
export async function apiFetchMultipart<T>(
  path: string,
  formData: FormData,
  context?: ActionContext,
): Promise<Result<T, ApiError>> {
  try {
    const { response, span } = await tracedFetch(
      path,
      'POST',
      { method: 'POST', credentials: 'include', body: formData },
      context,
    )
    if (response.status === 204) return Result.ok(undefined as T)
    const body = await response.json()
    if (!response.ok) {
      const error = body.error as ApiError
      telemetry.recordError(`action failed: ${error.type}`, {
        attributes: { 'error.type': error.type, action: context?.action ?? `POST ${path}` },
        ...(span ? { span } : null),
      })
      if (error.type === 'unauthenticated') handleUnauthenticated()
      return Result.err(error)
    }
    return Result.ok(body as T)
  } catch (error) {
    console.error(`[api] POST ${path} could not be completed`, error)
    return Result.err({ type: 'network_error', message: 'Impossible de contacter le serveur.' })
  }
}
