import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidProductOutcomeStatsAdapter } from '#infrastructure/database/fridge/product-outcome-stats.adapter'

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

async function createRecipe(id: string, householdId: string) {
  await db.table('recipe').insert({
    id,
    household_id: householdId,
    title: 'Test',
    source: 'user',
    instructions: 'Test',
    created_at: new Date(),
  })
}

let nextOutcomeId = 1

async function insertOutcome(
  householdId: string,
  overrides: Partial<{
    kind: 'consumed' | 'discarded'
    price: number | null
    occurredAt: Date
    recipeId: string | null
  }> = {},
) {
  await db.table('product_outcome').insert({
    id: `outcome_${nextOutcomeId++}`,
    household_id: householdId,
    product_id: 'p_1',
    kind: overrides.kind ?? 'discarded',
    product_name: 'Lait',
    category: 'Produits laitiers',
    location: 'fridge',
    amount: 1,
    unit: 'L',
    price: overrides.price === undefined ? 2 : overrides.price,
    recipe_id: overrides.recipeId ?? null,
    occurred_at: overrides.occurredAt ?? new Date(),
  })
}

test.group('LucidProductOutcomeStatsAdapter', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('earliestOutcomeAt() returns null for a household with none', async ({ assert }) => {
    await createUser('u_1', 'owner1@example.com')
    await createHousehold('h_1', 'u_1')
    const adapter = new LucidProductOutcomeStatsAdapter()

    assert.isNull(await adapter.earliestOutcomeAt('h_1'))
  })

  test('earliestOutcomeAt() returns the oldest occurredAt, ignoring other households', async ({
    assert,
  }) => {
    await createUser('u_2', 'owner2@example.com')
    await createHousehold('h_2', 'u_2')
    await createUser('u_3', 'owner3@example.com')
    await createHousehold('h_3', 'u_3')
    await insertOutcome('h_2', { occurredAt: new Date('2026-08-15T00:00:00Z') })
    await insertOutcome('h_2', { occurredAt: new Date('2026-08-01T00:00:00Z') })
    await insertOutcome('h_3', { occurredAt: new Date('2026-01-01T00:00:00Z') })

    const adapter = new LucidProductOutcomeStatsAdapter()
    const earliest = await adapter.earliestOutcomeAt('h_2')

    assert.equal(earliest?.toISOString(), '2026-08-01T00:00:00.000Z')
  })

  test('getStats() totals discarded/consumed count+value and the recipe share, scoped to the window', async ({
    assert,
  }) => {
    await createUser('u_4', 'owner4@example.com')
    await createHousehold('h_4', 'u_4')
    const inWindow = new Date('2026-09-10T00:00:00Z')
    const outOfWindow = new Date('2026-01-01T00:00:00Z')

    await createRecipe('r_1', 'h_4')
    await insertOutcome('h_4', { kind: 'discarded', price: 3, occurredAt: inWindow })
    await insertOutcome('h_4', { kind: 'discarded', price: null, occurredAt: inWindow })
    await insertOutcome('h_4', {
      kind: 'consumed',
      price: 2,
      recipeId: 'r_1',
      occurredAt: inWindow,
    })
    await insertOutcome('h_4', { kind: 'consumed', price: 4, occurredAt: inWindow })
    // Outside the requested window — must not count.
    await insertOutcome('h_4', { kind: 'discarded', price: 100, occurredAt: outOfWindow })

    const adapter = new LucidProductOutcomeStatsAdapter()
    const from = new Date('2026-09-01T00:00:00Z')
    const to = new Date('2026-09-30T00:00:00Z')
    const stats = await adapter.getStats('h_4', from, to, 6)

    assert.deepEqual(stats.discarded, { count: 2, value: 3 })
    assert.deepEqual(stats.consumed, { count: 2, value: 6 })
    assert.equal(stats.recipeSharePercent, 50)
    assert.lengthOf(stats.buckets, 6)
  })

  test('getStats() with no outcomes at all returns zeroed totals and six empty buckets', async ({
    assert,
  }) => {
    await createUser('u_5', 'owner5@example.com')
    await createHousehold('h_5', 'u_5')
    const adapter = new LucidProductOutcomeStatsAdapter()
    const now = new Date('2026-09-13T18:00:00Z')

    const stats = await adapter.getStats('h_5', now, now, 6)

    assert.deepEqual(stats.discarded, { count: 0, value: 0 })
    assert.deepEqual(stats.consumed, { count: 0, value: 0 })
    assert.equal(stats.recipeSharePercent, 0)
    assert.lengthOf(stats.buckets, 6)
    for (const bucket of stats.buckets) {
      assert.equal(bucket.discardedCount, 0)
      assert.equal(bucket.consumedCount, 0)
    }
  })

  test('getStats() buckets outcomes into the right sub-period, including the exact upper edge', async ({
    assert,
  }) => {
    await createUser('u_6', 'owner6@example.com')
    await createHousehold('h_6', 'u_6')
    const from = new Date('2026-09-01T00:00:00Z')
    const to = new Date('2026-09-07T00:00:00Z') // 6-day window, 6 buckets → 1 day each

    await insertOutcome('h_6', { kind: 'discarded', occurredAt: new Date('2026-09-01T00:00:00Z') }) // bucket 0
    await insertOutcome('h_6', { kind: 'consumed', occurredAt: new Date('2026-09-03T12:00:00Z') }) // bucket 2
    await insertOutcome('h_6', { kind: 'discarded', occurredAt: to }) // exactly `to` — must land in the last bucket, not overflow

    const adapter = new LucidProductOutcomeStatsAdapter()
    const stats = await adapter.getStats('h_6', from, to, 6)

    assert.equal(stats.buckets[0]?.discardedCount, 1)
    assert.equal(stats.buckets[2]?.consumedCount, 1)
    assert.equal(stats.buckets[5]?.discardedCount, 1)
    assert.equal(
      stats.buckets.reduce((sum, b) => sum + b.discardedCount + b.consumedCount, 0),
      3,
    )
  })
})
