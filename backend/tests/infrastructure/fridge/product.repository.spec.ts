import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidProductRepository } from '#infrastructure/database/fridge/product.repository'
import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'

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

function buildProduct(
  id: string,
  householdId: string,
  overrides: Partial<{ location: string; expiresAt: Date | null }> = {},
) {
  const quantity = Quantity.create(1, 'L')
  const location = Location.create(overrides.location ?? 'fridge')
  if (!quantity.ok || !location.ok) throw new Error('unreachable')

  return Product.create({
    id,
    householdId,
    name: 'Lait',
    quantity: quantity.value,
    location: location.value,
    category: 'Produits laitiers',
    expiresAt: overrides.expiresAt ?? null,
    createdAt: new Date(),
  })
}

test.group('LucidProductRepository', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('save() then findById() round-trips a product', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')

    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_1', 'h_1'))

    const found = await repository.findById('p_1')
    assert.equal(found?.name, 'Lait')
    assert.equal(found?.quantity.amount, 1)
    assert.equal(found?.location.value, 'fridge')
  })

  test('findByHousehold() filters by location', async ({ assert }) => {
    await createUser('u_2', 'owner2@example.com')
    await createHousehold('h_2', 'u_2')

    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_2', 'h_2', { location: 'fridge' }))
    await repository.save(buildProduct('p_3', 'h_2', { location: 'pantry' }))

    const fridgeOnly = await repository.findByHousehold('h_2', { location: 'fridge' })
    assert.lengthOf(fridgeOnly, 1)
    assert.equal(fridgeOnly[0]?.id, 'p_2')
  })

  test('findExpiringSoon() only returns products within the window', async ({ assert }) => {
    await createUser('u_3', 'owner3@example.com')
    await createHousehold('h_3', 'u_3')

    const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    const soon = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_4', 'h_3', { expiresAt: past }))
    await repository.save(buildProduct('p_5', 'h_3', { expiresAt: soon }))
    await repository.save(buildProduct('p_6', 'h_3', { expiresAt: far }))

    const expiring = await repository.findExpiringSoon('h_3', 3)
    assert.lengthOf(expiring, 1)
    assert.equal(expiring[0]?.id, 'p_5')
  })

  test('delete() removes the row', async ({ assert }) => {
    await createUser('u_4', 'owner4@example.com')
    await createHousehold('h_4', 'u_4')

    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_7', 'h_4'))
    await repository.delete('p_7')

    assert.isNull(await repository.findById('p_7'))
  })
})
