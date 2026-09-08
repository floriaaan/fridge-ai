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

  test('a new item has no Home Assistant uid and is unsynced', ({ assert }) => {
    const quantity = Quantity.create(1, 'pièce')
    const source = ShoppingItemSource.create('manual')
    if (!quantity.ok || !source.ok) throw new Error('bad fixtures')
    const item = ShoppingItem.create({
      id: 'item-1',
      householdId: 'household-1',
      name: 'Lait',
      quantity: quantity.value,
      source: source.value,
      createdAt: new Date(),
    })
    assert.isNull(item.haUid)
    assert.isNull(item.haSyncedAt)
  })

  test('markSynced() sets the uid and sync time without touching updatedAt', ({ assert }) => {
    const quantity = Quantity.create(1, 'pièce')
    const source = ShoppingItemSource.create('manual')
    if (!quantity.ok || !source.ok) throw new Error('bad fixtures')
    const createdAt = new Date('2026-09-01T00:00:00.000Z')
    const item = ShoppingItem.create({
      id: 'item-1',
      householdId: 'household-1',
      name: 'Lait',
      quantity: quantity.value,
      source: source.value,
      createdAt,
    })
    const syncedAt = new Date('2026-09-02T00:00:00.000Z')
    item.markSynced('ha-uid-1', syncedAt)
    assert.equal(item.haUid, 'ha-uid-1')
    assert.equal(item.haSyncedAt, syncedAt)
    assert.equal(item.updatedAt, createdAt)
  })

  test('markSynced(null, ...) clears a stale uid', ({ assert }) => {
    const quantity = Quantity.create(1, 'pièce')
    const source = ShoppingItemSource.create('manual')
    if (!quantity.ok || !source.ok) throw new Error('bad fixtures')
    const item = ShoppingItem.create({
      id: 'item-1',
      householdId: 'household-1',
      name: 'Lait',
      quantity: quantity.value,
      source: source.value,
      createdAt: new Date(),
    })
    item.markSynced('ha-uid-1', new Date())
    item.markSynced(null, new Date())
    assert.isNull(item.haUid)
  })

  test('adoptFromHomeAssistant() overwrites content and marks clean at the same instant', ({
    assert,
  }) => {
    const quantity = Quantity.create(1, 'pièce')
    const newQuantity = Quantity.create(2, 'L')
    const source = ShoppingItemSource.create('manual')
    if (!quantity.ok || !newQuantity.ok || !source.ok) throw new Error('bad fixtures')
    const item = ShoppingItem.create({
      id: 'item-1',
      householdId: 'household-1',
      name: 'Lait',
      quantity: quantity.value,
      source: source.value,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    const now = new Date('2026-09-03T00:00:00.000Z')
    item.adoptFromHomeAssistant(
      { name: 'Lait entier', checked: true, quantity: newQuantity.value },
      'ha-uid-2',
      now,
    )
    assert.equal(item.name, 'Lait entier')
    assert.isTrue(item.checked)
    assert.equal(item.quantity.amount, 2)
    assert.equal(item.haUid, 'ha-uid-2')
    assert.equal(item.updatedAt, now)
    assert.equal(item.haSyncedAt, now)
  })

  test('a local edit after a sync makes the item dirty again (updatedAt > haSyncedAt)', ({
    assert,
  }) => {
    const quantity = Quantity.create(1, 'pièce')
    const source = ShoppingItemSource.create('manual')
    if (!quantity.ok || !source.ok) throw new Error('bad fixtures')
    const item = ShoppingItem.create({
      id: 'item-1',
      householdId: 'household-1',
      name: 'Lait',
      quantity: quantity.value,
      source: source.value,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    item.markSynced('ha-uid-1', new Date('2026-09-02T00:00:00.000Z'))
    item.update({ name: 'Lait demi-écrémé' }, new Date('2026-09-03T00:00:00.000Z'))
    assert.isTrue(item.updatedAt > (item.haSyncedAt as Date))
  })
})
