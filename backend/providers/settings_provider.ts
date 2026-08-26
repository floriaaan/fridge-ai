import type { ApplicationService } from '@adonisjs/core/types'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'

export default class SettingsProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('settings.aiProviderSettingsRepository', async () => {
      const { LucidAiProviderSettingsRepository } = await import(
        '#infrastructure/database/settings/ai-provider-settings.repository'
      )
      return new LucidAiProviderSettingsRepository()
    })

    this.app.container.singleton('settings.aiSettingsProvider', async () => {
      const { EnvAiSettingsProvider } = await import('#infrastructure/settings/env-ai-settings-provider')
      const repository = await this.app.container.make('settings.aiProviderSettingsRepository')
      return new EnvAiSettingsProvider(repository)
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'settings.aiProviderSettingsRepository': AiProviderSettingsRepository
    'settings.aiSettingsProvider': AiSettingsProvider
  }
}
