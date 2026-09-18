import env from '#start/env'
import { GeminiReceiptExtractionAdapter } from './gemini-receipt-extraction.adapter.js'
import { OpenAiReceiptExtractionAdapter } from './openai-receipt-extraction.adapter.js'
import { OllamaReceiptExtractionAdapter } from './ollama-receipt-extraction.adapter.js'
import { GeminiRecipeGenerationAdapter } from './gemini-recipe-generation.adapter.js'
import { OpenAiRecipeGenerationAdapter } from './openai-recipe-generation.adapter.js'
import { OllamaRecipeGenerationAdapter } from './ollama-recipe-generation.adapter.js'
import { GeminiFridgeScanExtractionAdapter } from './gemini-fridge-scan-extraction.adapter.js'
import { OpenAiFridgeScanExtractionAdapter } from './openai-fridge-scan-extraction.adapter.js'
import { OllamaFridgeScanExtractionAdapter } from './ollama-fridge-scan-extraction.adapter.js'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { RecipeGenerationPort } from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { FridgeScanExtractionPort } from '#domain/fridge/interfaces/fridge-scan-extraction-port.interface'
import type { AiProvider } from '#domain/settings/ai-provider.vo'
import { SubscriptionRequiredError } from '#domain/settings/subscription.errors'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'
import { RecipeGenerationUnavailableError } from '#domain/recipe/recipe-generation.errors'

/**
 * Cheap DB read on every call (via `settings.resolveEffective()`), no adapter
 * rebuild unless the household's `activeProvider` changed — same hot-reload
 * mechanism `arr` uses for `getAuthInstance`
 * (`~/dev/arr/backend/src/infrastructure/auth/better-auth/instance.ts:163-181`).
 *
 * The cache is keyed by provider, not by household: adapters are built from
 * env credentials alone and hold no per-foyer state, so two foyers on the
 * same provider share one instance.
 */
function createResolver<T>(
  build: (provider: AiProvider) => T,
  unavailable: (provider: AiProvider) => Error,
) {
  const cache = new Map<AiProvider, T>()
  let testOverride: T | null = null

  return {
    /**
     * Test-only seam — when set, `resolve` short-circuits to it instead of
     * resolving env/DB-backed settings and constructing a real SDK client.
     * Never call this outside a test; the exported names are prefixed `__`
     * specifically to stand out at call sites.
     */
    setOverrideForTests(port: T | null): void {
      testOverride = port
      cache.clear()
    },

    async resolve(settings: AiSettingsProvider, householdId: string | null): Promise<T> {
      if (testOverride) return testOverride

      const effective = await settings.resolveEffective(householdId)
      const provider = effective.activeProvider

      // The stored choice can outlive its entitlement (subscription lapsed)
      // or its credentials (key removed from the env). Refuse here rather
      // than letting the adapter spend the operator's key.
      if (effective.lockedProviders.includes(provider))
        throw new SubscriptionRequiredError(provider)
      if (!effective.availableProviders.includes(provider)) throw unavailable(provider)

      const cached = cache.get(provider)
      if (cached) return cached

      const adapter = build(provider)
      cache.set(provider, adapter)
      return adapter
    },
  }
}

const receiptExtraction = createResolver<ReceiptExtractionPort>(
  (provider) => {
    switch (provider) {
      case 'gemini':
        return new GeminiReceiptExtractionAdapter(env.get('GEMINI_API_KEY', ''))
      case 'openai':
        return new OpenAiReceiptExtractionAdapter(env.get('OPENAI_API_KEY', ''))
      case 'ollama':
        return new OllamaReceiptExtractionAdapter(
          env.get('OLLAMA_BASE_URL', 'http://localhost:11434'),
          env.get('OLLAMA_VISION_MODEL', ''),
        )
    }
  },
  (provider) => new ReceiptExtractionUnavailableError(provider),
)

const recipeGeneration = createResolver<RecipeGenerationPort>(
  (provider) => {
    switch (provider) {
      case 'gemini':
        return new GeminiRecipeGenerationAdapter(env.get('GEMINI_API_KEY', ''))
      case 'openai':
        return new OpenAiRecipeGenerationAdapter(env.get('OPENAI_API_KEY', ''))
      case 'ollama':
        return new OllamaRecipeGenerationAdapter(
          env.get('OLLAMA_BASE_URL', 'http://localhost:11434'),
          env.get('OLLAMA_TEXT_MODEL', ''),
        )
    }
  },
  (provider) => new RecipeGenerationUnavailableError(provider),
)

const fridgeScanExtraction = createResolver<FridgeScanExtractionPort>(
  (provider) => {
    switch (provider) {
      case 'gemini':
        return new GeminiFridgeScanExtractionAdapter(env.get('GEMINI_API_KEY', ''))
      case 'openai':
        return new OpenAiFridgeScanExtractionAdapter(env.get('OPENAI_API_KEY', ''))
      case 'ollama':
        return new OllamaFridgeScanExtractionAdapter(
          env.get('OLLAMA_BASE_URL', 'http://localhost:11434'),
          env.get('OLLAMA_VISION_MODEL', ''),
        )
    }
  },
  // Fridge scan is a vision call like the receipt one, and shares its errors.
  (provider) => new ReceiptExtractionUnavailableError(provider),
)

export function __setReceiptExtractionOverrideForTests(port: ReceiptExtractionPort | null): void {
  receiptExtraction.setOverrideForTests(port)
}

export function __setRecipeGenerationOverrideForTests(port: RecipeGenerationPort | null): void {
  recipeGeneration.setOverrideForTests(port)
}

export function __setFridgeScanExtractionOverrideForTests(
  port: FridgeScanExtractionPort | null,
): void {
  fridgeScanExtraction.setOverrideForTests(port)
}

export function resolveReceiptExtractionAdapter(
  settings: AiSettingsProvider,
  householdId: string | null,
): Promise<ReceiptExtractionPort> {
  return receiptExtraction.resolve(settings, householdId)
}

export function resolveRecipeGenerationAdapter(
  settings: AiSettingsProvider,
  householdId: string | null,
): Promise<RecipeGenerationPort> {
  return recipeGeneration.resolve(settings, householdId)
}

export function resolveFridgeScanExtractionAdapter(
  settings: AiSettingsProvider,
  householdId: string | null,
): Promise<FridgeScanExtractionPort> {
  return fridgeScanExtraction.resolve(settings, householdId)
}
