import { apiFetch } from './http-client.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
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
