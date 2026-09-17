import env from '#start/env'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { EffectiveAiSettings } from '#domain/settings/effective-ai-settings'
import type { AiProvider } from '#domain/settings/ai-provider.vo'
import { AI_PROVIDERS } from '#domain/settings/ai-provider.vo'

const DEFAULT_PROVIDER: AiProvider = 'gemini'

/**
 * The fixed model each cloud provider's adapters use — kept in sync by hand
 * with the `model:` literal in `gemini-receipt-extraction.adapter.ts`,
 * `gemini-recipe-generation.adapter.ts`, `openai-receipt-extraction.adapter.ts`
 * and `openai-recipe-generation.adapter.ts`. Ollama has no fixed model: its
 * name comes from `OLLAMA_VISION_MODEL`/`OLLAMA_TEXT_MODEL` below.
 */
const CLOUD_MODELS: Record<'gemini' | 'openai', { vision: string; text: string }> = {
  gemini: { vision: 'gemini-2.5-flash', text: 'gemini-2.5-flash' },
  openai: { vision: 'gpt-4o-mini', text: 'gpt-4o-mini' },
}

/**
 * Merges the DB row (if any) with the env default — identical precedence to
 * `AuthSettingsProvider` in `arr` (DB wins once it exists, env is the
 * first-boot fallback, cf. docs/adr/0007).
 */
export class EnvAiSettingsProvider implements AiSettingsProvider {
  constructor(private readonly repository: AiProviderSettingsRepository) {}

  async resolveEffective(): Promise<EffectiveAiSettings> {
    const stored = await this.repository.find()
    const activeProvider =
      stored?.activeProvider ?? (env.get('AI_PROVIDER', DEFAULT_PROVIDER) as AiProvider)
    const availableProviders = AI_PROVIDERS.filter((provider) => this.hasCredentials(provider))

    return {
      activeProvider,
      source: stored ? 'database' : 'environment',
      availableProviders,
      models: this.modelsFor(activeProvider),
    }
  }

  private modelsFor(provider: AiProvider): { vision: string; text: string } {
    if (provider === 'ollama') {
      return {
        vision: env.get('OLLAMA_VISION_MODEL', ''),
        text: env.get('OLLAMA_TEXT_MODEL', ''),
      }
    }
    return CLOUD_MODELS[provider]
  }

  private hasCredentials(provider: AiProvider): boolean {
    switch (provider) {
      case 'gemini':
        return Boolean(env.get('GEMINI_API_KEY', ''))
      case 'openai':
        return Boolean(env.get('OPENAI_API_KEY', ''))
      case 'ollama':
        return Boolean(env.get('OLLAMA_BASE_URL', ''))
    }
  }
}
