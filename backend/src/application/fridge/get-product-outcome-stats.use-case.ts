import type { UseCase } from '#application/shared/use-case'
import type {
  ProductOutcomeStatsPort,
  ProductOutcomeStats,
} from '#domain/fridge/interfaces/product-outcome-stats.interface'
import type { Clock } from '#domain/shared/clock.interface'

/** The chart always renders this many sub-periods, whatever the window (spec §1). */
const BUCKET_COUNT = 6
const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface GetProductOutcomeStatsInput {
  householdId: string
  /** Absent = "tout", since the household's first ever outcome. */
  days?: number
}

/**
 * No `Result`: nothing here is a business failure, only infra errors that
 * propagate normally.
 */
export class GetProductOutcomeStats implements UseCase<
  GetProductOutcomeStatsInput,
  ProductOutcomeStats
> {
  constructor(
    private readonly stats: ProductOutcomeStatsPort,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetProductOutcomeStatsInput): Promise<ProductOutcomeStats> {
    const to = this.clock.now()
    const from =
      input.days !== undefined
        ? new Date(to.getTime() - input.days * MS_PER_DAY)
        : await this.stats.earliestOutcomeAt(input.householdId)

    return this.stats.getStats(input.householdId, from ?? to, to, BUCKET_COUNT)
  }
}
