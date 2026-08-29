import { apiFetch, apiFetchMultipart } from './http-client.js'

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
  expect(init.headers).toBeUndefined()
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
