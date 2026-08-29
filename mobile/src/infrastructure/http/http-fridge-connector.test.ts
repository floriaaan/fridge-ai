import { authClient } from '../auth/auth-client.js'
import { HttpFridgeConnector } from './http-fridge-connector.js'

jest.mock('../auth/auth-client.js', () => ({
  authClient: {
    signIn: {
      email: jest.fn(),
    },
  },
}))

const signInEmailMock = authClient.signIn.email as jest.Mock
const originalFetch = globalThis.fetch

afterEach(() => {
  signInEmailMock.mockReset()
})

test('signInEmail() maps an authClient error to Result.err using error.code/message', async () => {
  signInEmailMock.mockResolvedValue({
    error: { code: 'invalid_credentials', message: 'Identifiants invalides.' },
  })

  const connector = new HttpFridgeConnector()
  const result = await connector.signInEmail('a@b.com', 'wrong-password')

  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.error).toEqual({ type: 'invalid_credentials', message: 'Identifiants invalides.' })
  }
})

test('signInEmail() falls back to default type/message when error has no code/message', async () => {
  signInEmailMock.mockResolvedValue({ error: {} })

  const connector = new HttpFridgeConnector()
  const result = await connector.signInEmail('a@b.com', 'wrong-password')

  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.error).toEqual({ type: 'sign_in_failed', message: 'Connexion impossible.' })
  }
})

test('getProducts() returns [] when the request fails', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 500,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'server_error', message: 'oops' } }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  expect(await connector.getProducts()).toEqual([])

  globalThis.fetch = originalFetch
})

test('getProducts() builds the query string from location/expiringWithinDays', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ products: [] }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  await connector.getProducts({ location: 'freezer', expiringWithinDays: 5 })

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/api/products?location=freezer&expiringWithinDays=5'),
    expect.anything(),
  )

  globalThis.fetch = originalFetch
})

test('deleteProduct() maps a 204 response to Result.ok(undefined)', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ status: 204, ok: true }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.deleteProduct('some-id')

  expect(result).toEqual({ ok: true, value: undefined })

  globalThis.fetch = originalFetch
})

test('lookupProductByBarcode() returns null when the backend finds nothing', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ result: null }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  expect(await connector.lookupProductByBarcode('0000000000000')).toBeNull()

  globalThis.fetch = originalFetch
})

test('scanReceipt() posts a multipart image and unwraps the draft', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () =>
      Promise.resolve({
        draft: { storeName: 'Carrefour', scannedAt: '2026-08-28T10:00:00.000Z', totalAmount: 24.5, items: [] },
      }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.scanReceipt('file://receipt.jpg')

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.storeName).toBe('Carrefour')
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/receipts/scan')
  expect(init.body).toBeInstanceOf(FormData)

  globalThis.fetch = originalFetch
})

test('scanReceipt() returns Result.err on an extraction failure', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 422,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'extraction_failed', message: 'Extraction impossible.' } }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.scanReceipt('file://receipt.jpg')

  expect(result).toEqual({ ok: false, error: { type: 'extraction_failed', message: 'Extraction impossible.' } })

  globalThis.fetch = originalFetch
})

test('importReceipt() posts the JSON payload and unwraps receipt + products', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 201,
    ok: true,
    json: () =>
      Promise.resolve({
        receipt: { id: 'r1', storeName: 'Carrefour', scannedAt: '2026-08-28T10:00:00.000Z', totalAmount: 24.5, imageKey: null, itemsCount: 1, createdAt: '2026-08-28T10:05:00.000Z' },
        products: [],
      }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.importReceipt({
    storeName: 'Carrefour',
    scannedAt: '2026-08-28T10:00:00.000Z',
    totalAmount: 24.5,
    items: [{ name: 'Lait', quantity: 1, unit: 'L', location: 'fridge' }],
  })

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.receipt.id).toBe('r1')
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/receipts/import')
  expect(init.method).toBe('POST')

  globalThis.fetch = originalFetch
})

test('getReceipts() returns [] when the request fails', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 500,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'server_error', message: 'oops' } }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  expect(await connector.getReceipts()).toEqual([])

  globalThis.fetch = originalFetch
})

test('getReceipt() returns null when the backend finds nothing', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 404,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'receipt_not_found', message: 'not found' } }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  expect(await connector.getReceipt('missing')).toBeNull()

  globalThis.fetch = originalFetch
})

test('getAiSettings() unwraps the settings object directly (no envelope key)', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ activeProvider: 'gemini', source: 'environment', availableProviders: ['gemini'] }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const settings = await connector.getAiSettings()

  expect(settings).toEqual({ activeProvider: 'gemini', source: 'environment', availableProviders: ['gemini'] })

  globalThis.fetch = originalFetch
})

test('setActiveAiProvider() PATCHes the provider and returns Result.ok with the updated settings', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ activeProvider: 'openai', source: 'database', availableProviders: ['gemini', 'openai'] }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.setActiveAiProvider('openai')

  expect(result).toEqual({ ok: true, value: { activeProvider: 'openai', source: 'database', availableProviders: ['gemini', 'openai'] } })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/settings/ai')
  expect(init.method).toBe('PATCH')
  expect(JSON.parse(init.body)).toEqual({ provider: 'openai' })

  globalThis.fetch = originalFetch
})
