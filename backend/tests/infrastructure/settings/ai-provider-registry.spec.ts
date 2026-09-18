import { test } from '@japa/runner'
import {
  resolveReceiptExtractionAdapter,
  resolveRecipeGenerationAdapter,
} from '#infrastructure/settings/ai-provider-registry'
import { GeminiReceiptExtractionAdapter } from '#infrastructure/settings/gemini-receipt-extraction.adapter'
import { OllamaReceiptExtractionAdapter } from '#infrastructure/settings/ollama-receipt-extraction.adapter'
import { GeminiRecipeGenerationAdapter } from '#infrastructure/settings/gemini-recipe-generation.adapter'
import { OllamaRecipeGenerationAdapter } from '#infrastructure/settings/ollama-recipe-generation.adapter'
import { SubscriptionRequiredError } from '#domain/settings/subscription.errors'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { AiProvider } from '#domain/settings/ai-provider.vo'

function fakeSettings(
  provider: AiProvider,
  overrides: { availableProviders?: AiProvider[]; lockedProviders?: AiProvider[] } = {},
): AiSettingsProvider {
  return {
    async resolveEffective() {
      return {
        activeProvider: provider,
        source: 'environment',
        availableProviders: overrides.availableProviders ?? [provider],
        lockedProviders: overrides.lockedProviders ?? [],
        models: { vision: '', text: '' },
      }
    },
  }
}

test.group('resolveReceiptExtractionAdapter (ai-provider-registry)', () => {
  test('returns the same adapter instance when the provider is unchanged', async ({ assert }) => {
    const settings = fakeSettings('gemini')
    const first = await resolveReceiptExtractionAdapter(settings, 'h_1')
    const second = await resolveReceiptExtractionAdapter(settings, 'h_1')
    assert.strictEqual(first, second)
    assert.instanceOf(first, GeminiReceiptExtractionAdapter)
  })

  test('rebuilds the adapter when the provider changes', async ({ assert }) => {
    await resolveReceiptExtractionAdapter(fakeSettings('gemini'), 'h_1')
    const afterSwitch = await resolveReceiptExtractionAdapter(fakeSettings('ollama'), 'h_1')
    assert.instanceOf(afterSwitch, OllamaReceiptExtractionAdapter)
  })

  test('shares one adapter between two households on the same provider', async ({ assert }) => {
    const first = await resolveReceiptExtractionAdapter(fakeSettings('gemini'), 'h_1')
    const second = await resolveReceiptExtractionAdapter(fakeSettings('gemini'), 'h_2')
    assert.strictEqual(first, second)
  })

  test('refuses a paywalled provider instead of spending the operator key', async ({ assert }) => {
    // The stored choice outlives the entitlement: the foyer picked Gemini
    // while subscribed, the subscription lapsed, the row still says gemini.
    const settings = fakeSettings('gemini', {
      availableProviders: ['ollama'],
      lockedProviders: ['gemini'],
    })
    await assert.rejects(
      () => resolveReceiptExtractionAdapter(settings, 'h_1'),
      new SubscriptionRequiredError('gemini').message,
    )
  })

  test('refuses a provider whose credentials are gone', async ({ assert }) => {
    const settings = fakeSettings('openai', { availableProviders: [] })
    await assert.rejects(
      () => resolveReceiptExtractionAdapter(settings, 'h_1'),
      new ReceiptExtractionUnavailableError('openai').message,
    )
  })
})

test.group('resolveRecipeGenerationAdapter (ai-provider-registry)', () => {
  test('returns the same adapter instance when the provider is unchanged', async ({ assert }) => {
    const settings = fakeSettings('gemini')
    const first = await resolveRecipeGenerationAdapter(settings, 'h_1')
    const second = await resolveRecipeGenerationAdapter(settings, 'h_1')
    assert.strictEqual(first, second)
    assert.instanceOf(first, GeminiRecipeGenerationAdapter)
  })

  test('rebuilds the adapter when the provider changes', async ({ assert }) => {
    await resolveRecipeGenerationAdapter(fakeSettings('gemini'), 'h_1')
    const afterSwitch = await resolveRecipeGenerationAdapter(fakeSettings('ollama'), 'h_1')
    assert.instanceOf(afterSwitch, OllamaRecipeGenerationAdapter)
  })
})
