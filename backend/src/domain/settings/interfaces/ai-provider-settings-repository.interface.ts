import type { AiProviderSettings } from '../ai-provider-settings.aggregate.js'

export interface AiProviderSettingsRepository {
  find(): Promise<AiProviderSettings | null>
  save(settings: AiProviderSettings): Promise<void>
}
