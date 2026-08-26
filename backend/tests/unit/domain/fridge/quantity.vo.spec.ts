import { test } from '@japa/runner'
import { Quantity } from '#domain/fridge/quantity.vo'

test.group('Quantity', () => {
  test('accepts a positive integer amount with a unit', ({ assert }) => {
    const result = Quantity.create(2, 'piece')
    assert.isTrue(result.ok)
    if (result.ok) {
      assert.equal(result.value.amount, 2)
      assert.equal(result.value.unit, 'piece')
    }
  })

  test('rejects a non-integer amount', ({ assert }) => {
    // product.quantity is an INTEGER column (docs/phase-0/03-schema-base-de-donnees.md)
    const result = Quantity.create(1.5, 'kg')
    assert.isFalse(result.ok)
  })

  test('rejects a zero or negative amount', ({ assert }) => {
    const result = Quantity.create(0, 'kg')
    assert.isFalse(result.ok)
  })

  test('rejects an empty unit', ({ assert }) => {
    const result = Quantity.create(1, '   ')
    assert.isFalse(result.ok)
  })
})
