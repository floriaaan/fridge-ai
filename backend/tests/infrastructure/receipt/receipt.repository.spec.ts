import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidReceiptRepository } from '#infrastructure/database/receipt/receipt.repository'
import { Receipt } from '#domain/receipt/receipt.entity'

async function createUser(id: string, email: string) {
  await db.table('user').insert({
    id,
    name: email,
    email,
    email_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  })
}

async function createHousehold(id: string, ownerId: string) {
  await db.table('household').insert({
    id,
    name: 'Test household',
    owner_id: ownerId,
    invite_code: id.slice(0, 8).toUpperCase().padEnd(8, '0'),
    created_at: new Date(),
    updated_at: new Date(),
  })
}

test.group('LucidReceiptRepository', (group) => {
  group.each.setup(() => db.beginGlobalTransaction())
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('save() then findById()/findByHousehold() round-trip a receipt', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')

    const repository = new LucidReceiptRepository()
    const receipt = Receipt.create({
      id: 'r_1',
      householdId: 'h_1',
      storeName: 'Carrefour',
      scannedAt: new Date(),
      totalAmount: 12.5,
      itemsCount: 2,
      createdAt: new Date(),
    })
    await repository.save(receipt)

    const found = await repository.findById('r_1')
    assert.equal(found?.storeName, 'Carrefour')

    const byHousehold = await repository.findByHousehold('h_1')
    assert.lengthOf(byHousehold, 1)
  })
})
