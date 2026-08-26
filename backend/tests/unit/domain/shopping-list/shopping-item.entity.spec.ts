import { test } from '@japa/runner'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import { Quantity } from '#domain/fridge/quantity.vo'

function buildItem() {
  const quantity = Quantity.create(1, 'kg')
  const source = ShoppingItemSource.create('manual')
  if (!quantity.ok || !source.ok) throw new Error('unreachable')

  return ShoppingItem.create({
    id: 's_1',
    householdId: 'h_1',
    name: 'Farine',
    quantity: quantity.value,
    source: source.value,
    createdAt: new Date('2026-08-26T10:00:00Z'),
  })
}

test.group('ShoppingItem', () => {
  test('create() starts unchecked and stamps updatedAt = createdAt', ({ assert }) => {
    const item = buildItem()
    assert.isFalse(item.checked)
    assert.equal(item.updatedAt.toISOString(), item.createdAt.toISOString())
  })

  test('toggle() flips checked and stamps updatedAt', ({ assert }) => {
    const item = buildItem()
    item.toggle(new Date('2026-08-26T11:00:00Z'))
    assert.isTrue(item.checked)
    assert.equal(item.updatedAt.toISOString(), '2026-08-26T11:00:00.000Z')

    item.toggle(new Date('2026-08-26T12:00:00Z'))
    assert.isFalse(item.checked)
  })

  test('update() merges the patch and stamps updatedAt', ({ assert }) => {
    const item = buildItem()
    item.update({ name: 'Farine T55' }, new Date('2026-08-26T11:00:00Z'))
    assert.equal(item.name, 'Farine T55')
    assert.equal(item.updatedAt.toISOString(), '2026-08-26T11:00:00.000Z')
  })
})
