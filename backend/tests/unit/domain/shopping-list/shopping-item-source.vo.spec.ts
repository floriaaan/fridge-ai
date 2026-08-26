import { test } from '@japa/runner'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'

test.group('ShoppingItemSource', () => {
  test('accepts "manual"', ({ assert }) => {
    const result = ShoppingItemSource.create('manual')
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value.value, 'manual')
  })

  test('accepts "auto_expired" and "recipe"', ({ assert }) => {
    assert.isTrue(ShoppingItemSource.create('auto_expired').ok)
    assert.isTrue(ShoppingItemSource.create('recipe').ok)
  })

  test('rejects an unknown source', ({ assert }) => {
    const result = ShoppingItemSource.create('not-a-source')
    assert.isFalse(result.ok)
  })
})
