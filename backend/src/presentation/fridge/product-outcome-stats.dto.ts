import type { ProductOutcomeStats } from '#domain/fridge/interfaces/product-outcome-stats.interface'

export interface OutcomeBucketDto {
  from: string
  to: string
  discardedCount: number
  consumedCount: number
}

export interface ProductOutcomeStatsDto {
  from: string
  to: string
  discarded: { count: number; value: number }
  consumed: { count: number; value: number }
  recipeSharePercent: number
  buckets: OutcomeBucketDto[]
}

export function toProductOutcomeStatsDto(stats: ProductOutcomeStats): ProductOutcomeStatsDto {
  return {
    from: stats.from.toISOString(),
    to: stats.to.toISOString(),
    discarded: stats.discarded,
    consumed: stats.consumed,
    recipeSharePercent: stats.recipeSharePercent,
    buckets: stats.buckets.map((bucket) => ({
      from: bucket.from.toISOString(),
      to: bucket.to.toISOString(),
      discardedCount: bucket.discardedCount,
      consumedCount: bucket.consumedCount,
    })),
  }
}
