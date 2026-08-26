import { test } from '@japa/runner'
import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'

function buildProduct(expiresAt: Date | null = null) {
  const quantity = Quantity.create(1, 'L')
  const location = Location.create('fridge')
  if (!quantity.ok || !location.ok) throw new Error('unreachable')

  return Product.create({
    id: 'p_1',
    householdId: 'h_1',
    name: 'Lait',
    quantity: quantity.value,
    location: location.value,
    category: 'Produits laitiers',
    expiresAt,
    createdAt: new Date('2026-08-26T10:00:00Z'),
  })
}

test.group('Product', () => {
  test('create() defaults optional fields to null', ({ assert }) => {
    const product = buildProduct()
    assert.isNull(product.receiptId)
    assert.isNull(product.openedAt)
    assert.isNull(product.price)
    assert.isNull(product.imageKey)
    assert.equal(product.updatedAt.toISOString(), product.createdAt.toISOString())
  })

  test('update() merges the patch and stamps updatedAt', ({ assert }) => {
    const product = buildProduct()
    product.update({ name: 'Lait entier' }, new Date('2026-08-26T11:00:00Z'))
    assert.equal(product.name, 'Lait entier')
    assert.equal(product.updatedAt.toISOString(), '2026-08-26T11:00:00.000Z')
  })

  test('isExpiringSoon() is true within the window, false outside it', ({ assert }) => {
    const now = new Date('2026-08-26T00:00:00Z')
    const soon = buildProduct(new Date('2026-08-28T00:00:00Z'))
    const far = buildProduct(new Date('2026-09-26T00:00:00Z'))
    assert.isTrue(soon.isExpiringSoon(3, now))
    assert.isFalse(far.isExpiringSoon(3, now))
  })

  test('isExpiringSoon() is false once already expired', ({ assert }) => {
    const now = new Date('2026-08-26T00:00:00Z')
    const expired = buildProduct(new Date('2026-08-20T00:00:00Z'))
    assert.isFalse(expired.isExpiringSoon(3, now))
  })

  test('isExpiringSoon() is false with no expiry date', ({ assert }) => {
    const now = new Date('2026-08-26T00:00:00Z')
    assert.isFalse(buildProduct(null).isExpiringSoon(3, now))
  })

  test('isExpired() is true only once past expiresAt', ({ assert }) => {
    const now = new Date('2026-08-26T00:00:00Z')
    assert.isTrue(buildProduct(new Date('2026-08-20T00:00:00Z')).isExpired(now))
    assert.isFalse(buildProduct(new Date('2026-09-01T00:00:00Z')).isExpired(now))
    assert.isFalse(buildProduct(null).isExpired(now))
  })
})
