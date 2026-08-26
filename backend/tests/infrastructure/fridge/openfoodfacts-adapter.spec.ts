import { test } from '@japa/runner'
import { OpenFoodFactsAdapter } from '#infrastructure/fridge/openfoodfacts-adapter'

test.group('OpenFoodFactsAdapter', (group) => {
  const originalFetch = globalThis.fetch

  group.each.teardown(() => {
    globalThis.fetch = originalFetch
  })

  test('lookupByBarcode() maps a found product', async ({ assert }) => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          status: 1,
          product: { product_name: 'Nutella', categories_tags: ['en:spreads'], image_url: 'https://x/img.jpg' },
        }),
      )) as typeof fetch

    const result = await new OpenFoodFactsAdapter().lookupByBarcode('3017620422003')
    assert.equal(result?.name, 'Nutella')
    assert.equal(result?.category, 'spreads')
    assert.equal(result?.openfoodfactId, '3017620422003')
  })

  test('lookupByBarcode() returns null when not found', async ({ assert }) => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ status: 0 }))) as typeof fetch
    const result = await new OpenFoodFactsAdapter().lookupByBarcode('0000000000000')
    assert.isNull(result)
  })
})
