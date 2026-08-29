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

test('getProducts() returns the fixture list', async () => {
  const connector = new FakeFridgeConnector()
  const products = await connector.getProducts()
  expect(products.length).toBeGreaterThan(0)
})

test('getProducts() filters by location', async () => {
  const connector = new FakeFridgeConnector()
  const products = await connector.getProducts({ location: 'freezer' })
  expect(products.every((p) => p.location === 'freezer')).toBe(true)
  expect(products.length).toBeGreaterThan(0)
})

test('createProduct() adds a product retrievable via getProduct()', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.createProduct({
    name: 'Yaourts nature',
    quantity: { amount: 8, unit: 'unités' },
    location: 'fridge',
    category: 'Produits laitiers',
  })
  expect(result.ok).toBe(true)
  if (!result.ok) return

  const fetched = await connector.getProduct(result.value.id)
  expect(fetched?.name).toBe('Yaourts nature')
})

test('updateProduct() patches an existing product', async () => {
  const connector = new FakeFridgeConnector()
  const [first] = await connector.getProducts()

  const result = await connector.updateProduct(first.id, { name: 'Lait entier' })
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.name).toBe('Lait entier')
})

test('updateProduct() rejects an unknown id', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.updateProduct('does-not-exist', { name: 'x' })
  expect(result.ok).toBe(false)
})

test('deleteProduct() removes the product', async () => {
  const connector = new FakeFridgeConnector()
  const [first] = await connector.getProducts()

  const result = await connector.deleteProduct(first.id)
  expect(result.ok).toBe(true)
  expect(await connector.getProduct(first.id)).toBeNull()
})

test('lookupProductByBarcode() returns the fixture result for a known barcode', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.lookupProductByBarcode('3017620422003')
  expect(result?.name).toBe('Pâte à tartiner noisettes-cacao')
})

test('lookupProductByBarcode() returns null for an unknown barcode', async () => {
  const connector = new FakeFridgeConnector()
  expect(await connector.lookupProductByBarcode('0000000000000')).toBeNull()
})

test('scanReceipt() resolves with the fixture draft regardless of the imageUri', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.scanReceipt('file://anything.jpg')

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.storeName).toBe('Carrefour')
})

test('importReceipt() creates a receipt and one product per item, linked by receiptId', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.importReceipt({
    storeName: 'Monoprix',
    scannedAt: '2026-08-29T09:00:00.000Z',
    totalAmount: 10,
    items: [{ name: 'Yaourts', quantity: 1, unit: 'pack', location: 'fridge' }],
  })

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.value.receipt.storeName).toBe('Monoprix')
  expect(result.value.products).toHaveLength(1)
  expect(result.value.products[0].receiptId).toBe(result.value.receipt.id)

  const receipts = await connector.getReceipts()
  expect(receipts.some((r) => r.id === result.value.receipt.id)).toBe(true)
})

test('getReceipt() returns the receipt and its imported products', async () => {
  const connector = new FakeFridgeConnector()
  const imported = await connector.importReceipt({
    storeName: 'Monoprix',
    scannedAt: '2026-08-29T09:00:00.000Z',
    totalAmount: 10,
    items: [{ name: 'Yaourts', quantity: 1, unit: 'pack', location: 'fridge' }],
  })
  if (!imported.ok) throw new Error('setup failed')

  const found = await connector.getReceipt(imported.value.receipt.id)

  expect(found?.receipt.id).toBe(imported.value.receipt.id)
  expect(found?.products).toHaveLength(1)
})

test('getReceipt() returns null for an unknown id', async () => {
  const connector = new FakeFridgeConnector()
  expect(await connector.getReceipt('missing')).toBeNull()
})

test('getAiSettings() returns the fixture settings', async () => {
  const connector = new FakeFridgeConnector()
  expect(await connector.getAiSettings()).toEqual({
    activeProvider: 'gemini',
    source: 'environment',
    availableProviders: ['gemini', 'openai'],
  })
})

test('setActiveAiProvider() switches the active provider when it is available', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.setActiveAiProvider('openai')

  expect(result).toEqual({
    ok: true,
    value: { activeProvider: 'openai', source: 'environment', availableProviders: ['gemini', 'openai'] },
  })
})

test('setActiveAiProvider() rejects a provider that is not in availableProviders', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.setActiveAiProvider('ollama')

  expect(result.ok).toBe(false)
})
