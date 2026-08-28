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
