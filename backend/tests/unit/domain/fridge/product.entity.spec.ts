import { test } from '@japa/runner'
import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'

function buildProduct(
  expiresAt: Date | null = null,
  overrides: Partial<{ amount: number; price: number | null }> = {},
) {
  const quantity = Quantity.create(overrides.amount ?? 1, 'L')
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
    price: overrides.price ?? null,
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

  const AT = new Date('2026-09-13T18:00:00Z')

  test('create() sets initialQuantity to the created quantity', ({ assert }) => {
    assert.equal(buildProduct(null, { amount: 6 }).initialQuantity, 6)
  })

  test('update() raises initialQuantity when a correction goes above it, never lowers it', ({ assert }) => {
    const product = buildProduct(null, { amount: 6 })
    const up = Quantity.create(8, 'L')
    const down = Quantity.create(2, 'L')
    if (!up.ok || !down.ok) throw new Error('unreachable')

    product.update({ quantity: up.value }, AT)
    assert.equal(product.initialQuantity, 8)

    product.update({ quantity: down.value }, AT)
    assert.equal(product.initialQuantity, 8)
  })

  test('takeOut() of part of the stock decrements the product and prorates the price', ({ assert }) => {
    const product = buildProduct(null, { amount: 6, price: 3 })
    const result = product.takeOut(2, AT)

    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.strictEqual(result.value.remaining, product)
    assert.equal(product.quantity.amount, 4)
    assert.equal(product.initialQuantity, 6)
    assert.equal(product.updatedAt.toISOString(), AT.toISOString())
    assert.equal(result.value.taken.amount, 2)
    assert.equal(result.value.taken.unit, 'L')
    assert.equal(result.value.price, 1)
  })

  test('takeOut() of the whole stock leaves nothing and does not touch the product', ({ assert }) => {
    const product = buildProduct(null, { amount: 6, price: 3 })
    product.takeOut(2, AT)
    const result = product.takeOut(4, AT)

    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.isNull(result.value.remaining)
    assert.equal(product.quantity.amount, 4)
    assert.equal(result.value.price, 2)
  })

  test('takeOut() rounds the prorated price to the cent', ({ assert }) => {
    const result = buildProduct(null, { amount: 3, price: 1 }).takeOut(1, AT)
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value.price, 0.33)
  })

  test('takeOut() keeps a missing price missing', ({ assert }) => {
    const result = buildProduct(null, { amount: 2 }).takeOut(1, AT)
    assert.isTrue(result.ok)
    if (result.ok) assert.isNull(result.value.price)
  })

  test('takeOut() refuses zero, fractions, and more than the stock', ({ assert }) => {
    const product = buildProduct(null, { amount: 2 })
    for (const amount of [0, 1.5, 3]) {
      const result = product.takeOut(amount, AT)
      assert.isFalse(result.ok)
      if (!result.ok) assert.equal(result.error.field, 'quantity')
    }
    assert.equal(product.quantity.amount, 2)
  })
})
