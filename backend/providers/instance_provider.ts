import type { ApplicationService } from '@adonisjs/core/types'
import type { GetPublicStats } from '#application/instance/get-public-stats.use-case'

export default class InstanceProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('instance.getPublicStats', async () => {
      const { GetPublicStats } = await import('#application/instance/get-public-stats.use-case')
      const { LucidPublicStatsAdapter } =
        await import('#infrastructure/database/instance/public-stats.adapter')
      const env = (await import('#start/env')).default
      return new GetPublicStats(
        new LucidPublicStatsAdapter(),
        env.get('PUBLIC_STATS_ENABLED', false),
      )
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'instance.getPublicStats': GetPublicStats
  }
}
