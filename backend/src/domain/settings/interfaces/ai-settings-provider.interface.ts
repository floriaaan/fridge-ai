import type { EffectiveAiSettings } from '../effective-ai-settings.js'

export interface AiSettingsProvider {
  resolveEffective(): Promise<EffectiveAiSettings>
}
