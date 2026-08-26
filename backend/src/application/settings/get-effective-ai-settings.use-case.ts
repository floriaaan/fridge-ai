import type { UseCase } from '#application/shared/use-case'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { EffectiveAiSettings } from '#domain/settings/effective-ai-settings'

export class GetEffectiveAiSettings implements UseCase<Record<string, never>, EffectiveAiSettings> {
  constructor(private readonly settings: AiSettingsProvider) {}

  async execute(): Promise<EffectiveAiSettings> {
    return this.settings.resolveEffective()
  }
}
