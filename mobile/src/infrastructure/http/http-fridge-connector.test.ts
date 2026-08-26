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
