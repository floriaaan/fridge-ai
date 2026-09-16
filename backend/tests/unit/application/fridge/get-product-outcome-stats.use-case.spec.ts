import { test } from '@japa/runner'
import { GetProductOutcomeStats } from '#application/fridge/get-product-outcome-stats.use-case'
import type {
  ProductOutcomeStatsPort,
  ProductOutcomeStats,
} from '#domain/fridge/interfaces/product-outcome-stats.interface'
import { FIXED_CLOCK } from './fakes.js'

class FakeStatsPort implements ProductOutcomeStatsPort {
  calls: { from: Date; to: Date; bucketCount: number }[] = []
  earliestAt: Date | null = null
  result: ProductOutcomeStats = {
    from: new Date(0),
    to: new Date(0),
    discarded: { count: 0, value: 0 },
    consumed: { count: 0, value: 0 },
    recipeSharePercent: 0,
    buckets: [],
  }

  async getStats(_householdId: string, from: Date, to: Date, bucketCount: number) {
    this.calls.push({ from, to, bucketCount })
    return this.result
  }

  async earliestOutcomeAt() {
    return this.earliestAt
  }
}

test.group('GetProductOutcomeStats', () => {
  test('with `days`, the window is [now - days, now)', async ({ assert }) => {
    const stats = new FakeStatsPort()
    const useCase = new GetProductOutcomeStats(stats, FIXED_CLOCK)

    await useCase.execute({ householdId: 'h_1', days: 7 })

    assert.equal(stats.calls[0]?.to.toISOString(), FIXED_CLOCK.now().toISOString())
    assert.equal(stats.calls[0]?.from.toISOString(), '2026-09-06T18:00:00.000Z')
    assert.equal(stats.calls[0]?.bucketCount, 6)
  })

  test("without `days`, the window starts at the household's earliest outcome", async ({
    assert,
  }) => {
    const stats = new FakeStatsPort()
    stats.earliestAt = new Date('2026-08-01T00:00:00.000Z')
    const useCase = new GetProductOutcomeStats(stats, FIXED_CLOCK)

    await useCase.execute({ householdId: 'h_1' })

    assert.equal(stats.calls[0]?.from.toISOString(), '2026-08-01T00:00:00.000Z')
  })

  test('a household with no outcomes yet gets an empty (zero-width) window, not a crash', async ({
    assert,
  }) => {
    const stats = new FakeStatsPort()
    const useCase = new GetProductOutcomeStats(stats, FIXED_CLOCK)

    await useCase.execute({ householdId: 'h_1' })

    assert.equal(stats.calls[0]?.from.toISOString(), stats.calls[0]?.to.toISOString())
  })

  test('returns whatever the port answers', async ({ assert }) => {
    const stats = new FakeStatsPort()
    stats.result = {
      ...stats.result,
      discarded: { count: 3, value: 12.5 },
      consumed: { count: 5, value: 20 },
      recipeSharePercent: 40,
    }
    const useCase = new GetProductOutcomeStats(stats, FIXED_CLOCK)

    const result = await useCase.execute({ householdId: 'h_1', days: 30 })

    assert.deepEqual(result, stats.result)
  })
})
