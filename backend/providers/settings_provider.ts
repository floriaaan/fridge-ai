import type { ApplicationService } from '@adonisjs/core/types'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { SubscriptionPort } from '#domain/settings/interfaces/subscription-port.interface'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { RecipeGenerationPort } from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { FridgeScanExtractionPort } from '#domain/fridge/interfaces/fridge-scan-extraction-port.interface'

export default class SettingsProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('settings.aiProviderSettingsRepository', async () => {
      const { LucidAiProviderSettingsRepository } =
        await import('#infrastructure/database/settings/ai-provider-settings.repository')
      return new LucidAiProviderSettingsRepository()
    })

    this.app.container.singleton('settings.subscriptions', async () => {
      const { EnvSubscriptionAdapter } =
        await import('#infrastructure/settings/env-subscription.adapter')
      return new EnvSubscriptionAdapter()
    })

    this.app.container.singleton('settings.aiSettingsProvider', async () => {
      const { EnvAiSettingsProvider } =
        await import('#infrastructure/settings/env-ai-settings-provider')
      const repository = await this.app.container.make('settings.aiProviderSettingsRepository')
      const subscriptions = await this.app.container.make('settings.subscriptions')
      return new EnvAiSettingsProvider(repository, subscriptions)
    })

    this.app.container.singleton('settings.resolveReceiptExtractionPort', async () => {
      const { resolveReceiptExtractionAdapter } =
        await import('#infrastructure/settings/ai-provider-registry')
      const aiSettingsProvider = await this.app.container.make('settings.aiSettingsProvider')
      return (householdId: string | null) =>
        resolveReceiptExtractionAdapter(aiSettingsProvider, householdId)
    })

    this.app.container.singleton('settings.resolveRecipeGenerationPort', async () => {
      const { resolveRecipeGenerationAdapter } =
        await import('#infrastructure/settings/ai-provider-registry')
      const aiSettingsProvider = await this.app.container.make('settings.aiSettingsProvider')
      return (householdId: string | null) =>
        resolveRecipeGenerationAdapter(aiSettingsProvider, householdId)
    })

    this.app.container.singleton('settings.resolveFridgeScanExtractionPort', async () => {
      const { resolveFridgeScanExtractionAdapter } =
        await import('#infrastructure/settings/ai-provider-registry')
      const aiSettingsProvider = await this.app.container.make('settings.aiSettingsProvider')
      return (householdId: string | null) =>
        resolveFridgeScanExtractionAdapter(aiSettingsProvider, householdId)
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'settings.aiProviderSettingsRepository': AiProviderSettingsRepository
    'settings.aiSettingsProvider': AiSettingsProvider
    'settings.subscriptions': SubscriptionPort
    'settings.resolveReceiptExtractionPort': (
      householdId: string | null,
    ) => Promise<ReceiptExtractionPort>
    'settings.resolveRecipeGenerationPort': (
      householdId: string | null,
    ) => Promise<RecipeGenerationPort>
    'settings.resolveFridgeScanExtractionPort': (
      householdId: string | null,
    ) => Promise<FridgeScanExtractionPort>
  }
}
