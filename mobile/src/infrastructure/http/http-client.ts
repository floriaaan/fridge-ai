import { Platform } from 'react-native'
import { Result } from '../../domain/shared/result.js'
import { telemetry } from '../telemetry/telemetry.js'
import { authClient } from '../auth/auth-client.js'
import type { ApiError } from '../../domain/shared/api-error.js'

const API_URL = process.env.EXPO_PUBLIC_API_URL as string

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
async function tracedFetch(path: string, method: string, init: RequestInit): Promise<Response> {
  const span = telemetry.startClientSpan(`${method} ${path}`, {
    'http.request.method': method,
    // The path, never the query string: it is where ids and search terms live.
    'url.path': path.split('?')[0],
    'server.address': API_URL,
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
    return response
  } catch (error) {
    span?.end({ error })
    // A transport failure never reaches the backend, so this log record is the
    // only trace of it anywhere. It carries the span ids, so it lands next to
    // the (empty) trace in the same view.
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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<Result<T, ApiError>> {
  try {
    const response = await tracedFetch(path, init?.method ?? 'GET', {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
    // A 204 always means "success, no body" — nothing to parse.
    if (response.status === 204) return Result.ok(undefined as T)
    const body = await response.json()
    if (!response.ok) return Result.err(body.error as ApiError)
    return Result.ok(body as T)
  } catch {
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
export async function apiFetchMultipart<T>(path: string, formData: FormData): Promise<Result<T, ApiError>> {
  try {
    const response = await tracedFetch(path, 'POST', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    if (response.status === 204) return Result.ok(undefined as T)
    const body = await response.json()
    if (!response.ok) return Result.err(body.error as ApiError)
    return Result.ok(body as T)
  } catch {
    return Result.err({ type: 'network_error', message: 'Impossible de contacter le serveur.' })
  }
}
