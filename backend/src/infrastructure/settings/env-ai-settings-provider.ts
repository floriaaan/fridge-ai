import env from '#start/env'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { SubscriptionPort } from '#domain/settings/interfaces/subscription-port.interface'
import type { EffectiveAiSettings } from '#domain/settings/effective-ai-settings'
import type { AiProvider } from '#domain/settings/ai-provider.vo'
import { isCloudAiProvider, parseAllowedProviders } from '#domain/settings/ai-provider.vo'

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
 * Merges the household's DB row (if any) with the env whitelist — identical
 * precedence to `AuthSettingsProvider` in `arr` (DB wins once it exists, env
 * is the first-boot fallback, cf. docs/adr/0007).
 *
 * Three filters narrow `AI_PROVIDER` down to what a foyer may actually pick:
 * the whitelist itself, credentials being present, and the subscription gate
 * on cloud providers. A provider that clears the first two but not the third
 * lands in `lockedProviders` instead of disappearing.
 */
export class EnvAiSettingsProvider implements AiSettingsProvider {
  constructor(
    private readonly repository: AiProviderSettingsRepository,
    private readonly subscriptions: SubscriptionPort,
  ) {}

  async resolveEffective(householdId: string | null): Promise<EffectiveAiSettings> {
    const allowed = parseAllowedProviders(env.get('AI_PROVIDER', ''))
    const configured = allowed.filter((provider) => this.hasCredentials(provider))

    const subscribed = await this.subscriptions.hasActiveSubscription(householdId)
    const lockedProviders = subscribed ? [] : configured.filter(isCloudAiProvider)
    const availableProviders = configured.filter((provider) => !lockedProviders.includes(provider))

    const stored = householdId ? await this.repository.find(householdId) : null
    const activeProvider = stored?.activeProvider ?? availableProviders[0] ?? allowed[0]

    return {
      activeProvider,
      source: stored ? 'database' : 'environment',
      availableProviders,
      lockedProviders,
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
