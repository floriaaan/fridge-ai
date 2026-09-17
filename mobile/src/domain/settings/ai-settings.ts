export type AiProvider = 'gemini' | 'openai' | 'ollama'

export const AI_PROVIDERS: readonly AiProvider[] = ['gemini', 'openai', 'ollama']

/** Mirrors `AiSettingsDto` (= backend's `EffectiveAiSettings`) field-for-field. */
export interface AiSettings {
  activeProvider: AiProvider
  source: 'database' | 'environment'
  availableProviders: AiProvider[]
  /** The active provider's vision/text model — `''` when unset (Ollama only). */
  models: { vision: string; text: string }
}
