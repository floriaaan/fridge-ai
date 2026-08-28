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

test('getShoppingItems() returns the fixture list', async () => {
  const connector = new FakeFridgeConnector()
  const items = await connector.getShoppingItems()
  expect(items.length).toBeGreaterThan(0)
})

test('toggleShoppingItem() flips checked and persists across calls', async () => {
  const connector = new FakeFridgeConnector()
  const [first] = await connector.getShoppingItems()
  expect(first.checked).toBe(false)

  const result = await connector.toggleShoppingItem(first.id, true)
  expect(result.ok).toBe(true)

  const [updated] = await connector.getShoppingItems()
  expect(updated.checked).toBe(true)
})

test('toggleShoppingItem() rejects an unknown id', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.toggleShoppingItem('does-not-exist', true)
  expect(result.ok).toBe(false)
})

test('getRecipes() returns the fixture list', async () => {
  const connector = new FakeFridgeConnector()
  const recipes = await connector.getRecipes()
  expect(recipes.length).toBeGreaterThan(0)
})
