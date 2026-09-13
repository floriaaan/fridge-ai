import { test } from '@japa/runner'
import { Product } from '#domain/fridge/product.entity'
import { ProductOutcome } from '#domain/fridge/product-outcome.entity'
import { OutcomeKind } from '#domain/fridge/outcome-kind.vo'
import { DiscardReason } from '#domain/fridge/discard-reason.vo'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'

const AT = new Date('2026-09-13T18:00:00Z')

function buildYaourts() {
  const quantity = Quantity.create(6, 'unités')
  const location = Location.create('fridge')
  if (!quantity.ok || !location.ok) throw new Error('unreachable')
  return Product.create({
    id: 'p_1',
    householdId: 'h_1',
    name: 'Yaourts nature',
    quantity: quantity.value,
    location: location.value,
    category: 'Produits laitiers',
    categories: ['yogurts'],
    expiresAt: new Date('2026-09-10T00:00:00Z'),
    price: 3,
    createdAt: new Date('2026-09-01T10:00:00Z'),
  })
}

test.group('ProductOutcome', () => {
  test('fromProduct() snapshots the product and records the part taken, not the stock left', ({ assert }) => {
    const product = buildYaourts()
    const takeOut = product.takeOut(2, AT)
    const reason = DiscardReason.create('expired')
    if (!takeOut.ok || !reason.ok) throw new Error('unreachable')

    const outcome = ProductOutcome.fromProduct(product, {
      id: 'o_1',
      kind: OutcomeKind.discarded(),
      discardReason: reason.value,
      recordedBy: 'u_1',
      recipeId: null,
      takeOut: takeOut.value,
      at: AT,
    })

    assert.equal(outcome.id, 'o_1')
    assert.equal(outcome.householdId, 'h_1')
    assert.equal(outcome.productId, 'p_1')
    assert.equal(outcome.kind.value, 'discarded')
    assert.equal(outcome.discardReason?.value, 'expired')
    assert.equal(outcome.productName, 'Yaourts nature')
    assert.equal(outcome.category, 'Produits laitiers')
    assert.deepEqual(outcome.categories, ['yogurts'])
    assert.equal(outcome.location.value, 'fridge')
    assert.equal(outcome.quantity.amount, 2)
    assert.equal(outcome.price, 1)
    assert.equal(outcome.expiresAt?.toISOString(), '2026-09-10T00:00:00.000Z')
    assert.equal(outcome.occurredAt.toISOString(), AT.toISOString())
  })
})
