import { apiFetch, apiFetchMultipart } from './http-client.js'
import { queryClient } from '../../application/shared/query-client.js'

// `http-client.ts` reads the session cookie via `authClient.getCookie()` on
// every request. The real client pulls in `better-auth/react`, an ESM-only
// package Jest can't parse without this module being replaced first — same
// convention as `http-fridge-connector.test.ts`.
jest.mock('../auth/auth-client.js', () => ({
  authClient: { getCookie: jest.fn().mockResolvedValue(''), signOut: jest.fn().mockResolvedValue(undefined) },
}))

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  queryClient.clear()
})

test('apiFetch() resolves Result.ok(undefined) on a 204 response without parsing a body', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 204,
    ok: true,
    json: () => Promise.reject(new Error('should not be called on 204')),
  }) as unknown as typeof fetch

  const result = await apiFetch<void>('/api/products/some-id', { method: 'DELETE' })

  expect(result).toEqual({ ok: true, value: undefined })
})

test('apiFetch() still parses JSON on a normal 200 response', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ hello: 'world' }),
  }) as unknown as typeof fetch

  const result = await apiFetch<{ hello: string }>('/api/whatever')

  expect(result).toEqual({ ok: true, value: { hello: 'world' } })
})

test('apiFetchMultipart() POSTs the given FormData without a JSON Content-Type header', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ draft: { storeName: 'Carrefour' } }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const formData = new FormData()
  const result = await apiFetchMultipart<{ draft: { storeName: string } }>('/api/receipts/scan', formData)

  expect(result).toEqual({ ok: true, value: { draft: { storeName: 'Carrefour' } } })
  const [, init] = fetchMock.mock.calls[0]
  expect(init.method).toBe('POST')
  expect(init.body).toBe(formData)
  // Not literally `undefined` any more — the cookie/traceparent injection
  // always produces a headers object now — but the point of this test is
  // still true: no Content-Type, so `fetch` derives the multipart boundary
  // from the FormData itself instead of it being overwritten.
  expect(init.headers).not.toHaveProperty('Content-Type')
})

test('apiFetchMultipart() maps a non-ok response to Result.err', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 422,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'extraction_failed', message: 'oops' } }),
  }) as unknown as typeof fetch

  const result = await apiFetchMultipart('/api/receipts/scan', new FormData())

  expect(result).toEqual({ ok: false, error: { type: 'extraction_failed', message: 'oops' } })
})

test('an "unauthenticated" response flips the cached session to signed-out instead of leaving it stale', async () => {
  // A gate reading `useSessionQuery()` would otherwise still see the last
  // truthy session from cold start — this is the exact bug report: the
  // backend says unauthenticated, but nothing tells the app.
  queryClient.setQueryData(['session'], { userId: 'u1' })

  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 401,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'unauthenticated', message: 'Authentication required.' } }),
  }) as unknown as typeof fetch

  const result = await apiFetch('/api/products')

  expect(result.ok).toBe(false)
  expect(queryClient.getQueryData(['session'])).toBeNull()
})

test('another 401-shaped error (a rejected login, say) does not touch the cached session', async () => {
  queryClient.setQueryData(['session'], { userId: 'u1' })

  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 401,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'invalid_credentials', message: 'Email ou mot de passe invalide.' } }),
  }) as unknown as typeof fetch

  await apiFetch('/api/products')

  expect(queryClient.getQueryData(['session'])).toEqual({ userId: 'u1' })
})
