import type { ApplicationService } from '@adonisjs/core/types'
import type { GetPublicStats } from '#application/instance/get-public-stats.use-case'
import type { GetInstanceInfo } from '#application/instance/get-instance-info.use-case'

export default class InstanceProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('instance.getPublicStats', async () => {
      const { GetPublicStats } = await import('#application/instance/get-public-stats.use-case')
      const { LucidPublicStatsAdapter } =
        await import('#infrastructure/database/instance/public-stats.adapter')
      const envModule = await import('#start/env')
      const env = envModule.default
      return new GetPublicStats(
        new LucidPublicStatsAdapter(),
        env.get('PUBLIC_STATS_ENABLED', false),
      )
    })

    this.app.container.singleton('instance.getInstanceInfo', async () => {
      const { GetInstanceInfo } = await import('#application/instance/get-instance-info.use-case')
      const { readFileSync } = await import('node:fs')
      const envModule = await import('#start/env')
      const env = envModule.default

      const packageJsonUrl = this.app.makeURL('package.json')
      const { version } = JSON.parse(readFileSync(packageJsonUrl, 'utf-8')) as { version: string }

      return new GetInstanceInfo({
        mode: env.get('INSTANCE_MODE', 'self-hosted'),
        name: env.get('INSTANCE_NAME') ?? null,
        version,
      })
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'instance.getPublicStats': GetPublicStats
    'instance.getInstanceInfo': GetInstanceInfo
  }
}
