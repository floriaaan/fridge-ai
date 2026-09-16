export interface OutcomeBucket {
  from: Date
  to: Date
  discardedCount: number
  consumedCount: number
}

export interface ProductOutcomeStats {
  from: Date
  to: Date
  discarded: { count: number; value: number }
  consumed: { count: number; value: number }
  /** 0 when `consumed.count` is 0 — never a division by zero. */
  recipeSharePercent: number
  /** Always `bucketCount` entries, oldest first, even when a bucket holds nothing. */
  buckets: OutcomeBucket[]
}

/**
 * A read model over `product_outcome`, not a `Product` concern — kept off
 * `ProductRepository` because it has nothing to do with the aggregate's own
 * invariants (docs/superpowers/specs/2026-09-14-waste-stats-design.md).
 */
export interface ProductOutcomeStatsPort {
  getStats(
    householdId: string,
    from: Date,
    to: Date,
    bucketCount: number,
  ): Promise<ProductOutcomeStats>
  /** `null` when the household has never recorded an outcome. */
  earliestOutcomeAt(householdId: string): Promise<Date | null>
}
