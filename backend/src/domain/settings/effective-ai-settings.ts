import type { AiProvider } from './ai-provider.vo.js'

/** Never persisted — `AiSettingsProvider.resolveEffective()`'s return shape. */
export interface EffectiveAiSettings {
  activeProvider: AiProvider
  source: 'database' | 'environment'
  /** Whitelisted, credentialed, and not paywalled — what the foyer can pick. */
  availableProviders: AiProvider[]
  /**
   * Whitelisted and credentialed, but behind a subscription this household
   * does not have. Shown in the picker as locked rather than hidden, so the
   * paywall explains itself instead of looking like a missing key.
   */
  lockedProviders: AiProvider[]
  /**
   * The vision/text models the active provider actually uses — `''` when
   * unset (only possible for Ollama, whose model names are env-configured
   * rather than fixed). Lets the app warn before a scan/generation call
   * that would otherwise fail with a bare `provider_not_configured`.
   */
  models: { vision: string; text: string }
}
