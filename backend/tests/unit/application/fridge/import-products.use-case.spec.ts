import { test } from '@japa/runner'
import { ImportProducts } from '#application/fridge/import-products.use-case'
import { FakeProductRepository, FIXED_CLOCK, SEQUENTIAL_IDS } from './fakes.js'

test.group('ImportProducts', () => {
  test('creates a product per item with no receipt and no price', async ({ assert }) => {
    const products = new FakeProductRepository()
    const useCase = new ImportProducts(products, SEQUENTIAL_IDS('p'), FIXED_CLOCK)

    const result = await useCase.execute({
      householdId: 'h_1',
      items: [
        { name: 'Yaourts', quantity: 4, unit: 'pièce', category: 'Laitier', location: 'fridge', expiresAt: null },
        { name: 'Épinards', quantity: 1, unit: 'pièce', category: null, location: 'freezer', expiresAt: null },
      ],
    })

    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.lengthOf(result.value.products, 2)
    for (const product of result.value.products) {
      assert.isNull(product.receiptId)
      assert.isNull(product.price)
      assert.equal(product.householdId, 'h_1')
    }
    assert.equal(result.value.products[1]?.category, 'Non catégorisé')
    assert.equal(products.products.size, 2)
  })

  test('fails validation on an invalid location without writing anything', async ({ assert }) => {
    const products = new FakeProductRepository()
    const useCase = new ImportProducts(products, SEQUENTIAL_IDS('p'), FIXED_CLOCK)

    const result = await useCase.execute({
      householdId: 'h_1',
      items: [
        { name: 'X', quantity: 1, unit: 'pièce', category: null, location: 'garage', expiresAt: null },
      ],
    })

    assert.isFalse(result.ok)
    assert.equal(products.products.size, 0)
  })
})
