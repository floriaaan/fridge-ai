import type { ApplicationService } from '@adonisjs/core/types'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'

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

    this.app.container.singleton('settings.resolveReceiptExtractionPort', async () => {
      const { resolveReceiptExtractionAdapter } = await import('#infrastructure/settings/ai-provider-registry')
      const aiSettingsProvider = await this.app.container.make('settings.aiSettingsProvider')
      return () => resolveReceiptExtractionAdapter(aiSettingsProvider)
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'settings.aiProviderSettingsRepository': AiProviderSettingsRepository
    'settings.aiSettingsProvider': AiSettingsProvider
    'settings.resolveReceiptExtractionPort': () => Promise<ReceiptExtractionPort>
  }
}
