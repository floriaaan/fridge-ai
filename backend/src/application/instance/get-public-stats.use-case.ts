import type { UseCase } from '#application/shared/use-case'
import type { PublicStats, PublicStatsPort } from '#domain/instance/interfaces/public-stats.interface'

/**
 * Opt-in per instance (`PUBLIC_STATS_ENABLED`): even aggregated, the counts of
 * a one-household homelab describe that household, so a self-hoster has to
 * ask for them to be public. `null` = disabled.
 */
export class GetPublicStats implements UseCase<void, PublicStats | null> {
  constructor(
    private readonly stats: PublicStatsPort,
    private readonly enabled: boolean,
  ) {}

  async execute(): Promise<PublicStats | null> {
    if (!this.enabled) return null
    return this.stats.getStats()
  }
}
