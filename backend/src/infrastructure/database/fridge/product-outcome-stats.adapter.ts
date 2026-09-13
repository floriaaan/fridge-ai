import db from '@adonisjs/lucid/services/db'
import type {
  ProductOutcomeStatsPort,
  ProductOutcomeStats,
} from '#domain/fridge/interfaces/product-outcome-stats.interface'

/**
 * Two grouped scans over `product_outcome` rather than one row-by-row pass:
 * `width_bucket` puts Postgres' own bucketing arithmetic to work instead of
 * fetching every row and bucketing in JS, the same reasoning `cookStatsFor`
 * (`recipe.repository.ts`) uses for its own single grouped query.
 */
export class LucidProductOutcomeStatsAdapter implements ProductOutcomeStatsPort {
  async earliestOutcomeAt(householdId: string): Promise<Date | null> {
    const { rows } = await db.rawQuery(
      `select min(occurred_at) as first_at from product_outcome where household_id = ?`,
      [householdId],
    )
    const firstAt = (rows as { first_at: Date | string | null }[])[0]?.first_at
    return firstAt ? new Date(firstAt) : null
  }

  async getStats(
    householdId: string,
    from: Date,
    to: Date,
    bucketCount: number,
  ): Promise<ProductOutcomeStats> {
    const totals = await this.getTotals(householdId, from, to)
    const buckets = await this.getBuckets(householdId, from, to, bucketCount)
    return { from, to, ...totals, buckets }
  }

  private async getTotals(
    householdId: string,
    from: Date,
    to: Date,
  ): Promise<Pick<ProductOutcomeStats, 'discarded' | 'consumed' | 'recipeSharePercent'>> {
    const { rows } = await db.rawQuery(
      `select kind,
              count(*)::int as cnt,
              coalesce(sum(price), 0)::numeric as val,
              count(*) filter (where recipe_id is not null)::int as recipe_cnt
         from product_outcome
        where household_id = ?
          and occurred_at >= ?
          and occurred_at <= ?
        group by kind`,
      [householdId, from.toISOString(), to.toISOString()],
    )

    let discarded = { count: 0, value: 0 }
    let consumed = { count: 0, value: 0 }
    let consumedFromRecipe = 0

    for (const row of rows as { kind: string; cnt: number; val: string; recipe_cnt: number }[]) {
      if (row.kind === 'discarded') discarded = { count: row.cnt, value: Number(row.val) }
      else if (row.kind === 'consumed') {
        consumed = { count: row.cnt, value: Number(row.val) }
        consumedFromRecipe = row.recipe_cnt
      }
    }

    const recipeSharePercent =
      consumed.count === 0 ? 0 : Math.round((consumedFromRecipe / consumed.count) * 100)
    return { discarded, consumed, recipeSharePercent }
  }

  private async getBuckets(
    householdId: string,
    from: Date,
    to: Date,
    bucketCount: number,
  ): Promise<ProductOutcomeStats['buckets']> {
    const boundaries = Array.from({ length: bucketCount + 1 }, (_, i) => {
      const t = from.getTime() + ((to.getTime() - from.getTime()) * i) / bucketCount
      return new Date(t)
    })

    const counts = new Map<number, { discardedCount: number; consumedCount: number }>()
    // An empty (zero-width) window has nothing to bucket — `width_bucket`'s
    // second and third arguments must differ, and there is no outcome to find
    // anyway when `from === to` (a household with no outcomes yet).
    if (from.getTime() < to.getTime()) {
      const { rows } = await db.rawQuery(
        `select
            least(
              width_bucket(extract(epoch from occurred_at), extract(epoch from ?::timestamptz), extract(epoch from ?::timestamptz), ?),
              ?
            ) as bucket,
            kind,
            count(*)::int as cnt
          from product_outcome
         where household_id = ?
           and occurred_at >= ?
           and occurred_at <= ?
         group by bucket, kind`,
        [
          from.toISOString(),
          to.toISOString(),
          bucketCount,
          bucketCount,
          householdId,
          from.toISOString(),
          to.toISOString(),
        ],
      )

      for (const row of rows as { bucket: number; kind: string; cnt: number }[]) {
        const entry = counts.get(row.bucket) ?? { discardedCount: 0, consumedCount: 0 }
        if (row.kind === 'discarded') entry.discardedCount = row.cnt
        else if (row.kind === 'consumed') entry.consumedCount = row.cnt
        counts.set(row.bucket, entry)
      }
    }

    return Array.from({ length: bucketCount }, (_, i) => {
      const entry = counts.get(i + 1) ?? { discardedCount: 0, consumedCount: 0 }
      return { from: boundaries[i]!, to: boundaries[i + 1]!, ...entry }
    })
  }
}
