/** Structurally identical to the backend's `OutcomeBucketDto` (`product-outcome-stats.dto.ts`). */
export interface OutcomeBucket {
  from: string
  to: string
  discardedCount: number
  consumedCount: number
}

/**
 * Structurally identical to the backend's `ProductOutcomeStatsDto` — dates
 * stay ISO strings on the wire, same convention as every other domain type
 * here (`Product`, `ProductOutcome`).
 */
export interface ProductOutcomeStats {
  from: string
  to: string
  discarded: { count: number; value: number }
  consumed: { count: number; value: number }
  /** 0 when `consumed.count` is 0 — never a division by zero. */
  recipeSharePercent: number
  /** Always 6 entries, oldest first, even when a bucket holds nothing. */
  buckets: OutcomeBucket[]
}
