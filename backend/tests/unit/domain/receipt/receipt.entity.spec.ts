import { test } from '@japa/runner'
import { Receipt } from '#domain/receipt/receipt.entity'

test.group('Receipt', () => {
  test('create() defaults imageKey to null', ({ assert }) => {
    const receipt = Receipt.create({
      id: 'r_1',
      householdId: 'h_1',
      storeName: 'Carrefour',
      scannedAt: new Date('2026-08-26T18:00:00Z'),
      totalAmount: 23.47,
      itemsCount: 3,
      createdAt: new Date('2026-08-26T18:00:00Z'),
    })
    assert.isNull(receipt.imageKey)
    assert.equal(receipt.itemsCount, 3)
    assert.equal(receipt.storeName, 'Carrefour')
  })
})
