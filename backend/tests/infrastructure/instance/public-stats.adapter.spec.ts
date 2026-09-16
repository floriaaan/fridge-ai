import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidPublicStatsAdapter } from '#infrastructure/database/instance/public-stats.adapter'

async function createHousehold(id: string) {
  const ownerId = `u_${id}`
  await db.table('user').insert({
    id: ownerId,
    name: ownerId,
    email: `${ownerId}@example.com`,
    email_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  })
  await db.table('household').insert({
    id,
    name: 'Test household',
    owner_id: ownerId,
    invite_code: id.toUpperCase().padEnd(8, '0').slice(0, 8),
    created_at: new Date(),
    updated_at: new Date(),
  })
}

async function insertOutcome(id: string, householdId: string, kind: 'consumed' | 'discarded') {
  await db.table('product_outcome').insert({
    id,
    household_id: householdId,
    product_id: 'p_1',
    kind,
    product_name: 'Lait',
    category: 'Produits laitiers',
    location: 'fridge',
    amount: 1,
    unit: 'L',
    price: null,
    recipe_id: null,
    occurred_at: new Date(),
  })
}

async function insertRecipe(id: string, householdId: string, source: 'ai' | 'user') {
  await db.table('recipe').insert({
    id,
    household_id: householdId,
    title: 'Test',
    source,
    instructions: 'Test',
    created_at: new Date(),
  })
}

test.group('LucidPublicStatsAdapter', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('counts households, consumed outcomes only, and AI recipes only', async ({ assert }) => {
    const before = await new LucidPublicStatsAdapter().getStats()

    await createHousehold('hps1')
    await createHousehold('hps2')
    await insertOutcome('o_ps1', 'hps1', 'consumed')
    await insertOutcome('o_ps2', 'hps2', 'consumed')
    await insertOutcome('o_ps3', 'hps2', 'discarded')
    await insertRecipe('r_ps1', 'hps1', 'ai')
    await insertRecipe('r_ps2', 'hps1', 'user')

    const after = await new LucidPublicStatsAdapter().getStats()

    assert.equal(after.households - before.households, 2)
    assert.equal(after.productsConsumed - before.productsConsumed, 2)
    assert.equal(after.recipesGenerated - before.recipesGenerated, 1)
  })
})
