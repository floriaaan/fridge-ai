import type { AiProvider } from './ai-provider.vo.js'

/** Never persisted — `AiSettingsProvider.resolveEffective()`'s return shape. */
export interface EffectiveAiSettings {
  activeProvider: AiProvider
  source: 'database' | 'environment'
  availableProviders: AiProvider[]
}
