import { FakeFridgeConnector } from './fake-fridge-connector.js'

test('getSession() starts null, sign-in populates it, sign-out clears it', async () => {
  const connector = new FakeFridgeConnector()
  expect(await connector.getSession()).toBeNull()

  const signIn = await connector.signInEmail('a@b.com', 'password')
  expect(signIn.ok).toBe(true)
  expect(await connector.getSession()).not.toBeNull()

  await connector.signOut()
  expect(await connector.getSession()).toBeNull()
})

test('signInEmail() rejects an empty password', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.signInEmail('a@b.com', '')
  expect(result.ok).toBe(false)
})

test('getAuthMethods() returns both methods enabled', async () => {
  const connector = new FakeFridgeConnector()
  const methods = await connector.getAuthMethods()
  expect(methods).toHaveLength(2)
  expect(methods.every((m) => m.enabled)).toBe(true)
})
