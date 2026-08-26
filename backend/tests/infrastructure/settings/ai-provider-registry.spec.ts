import { test } from '@japa/runner'
import { resolveReceiptExtractionAdapter } from '#infrastructure/settings/ai-provider-registry'
import { GeminiReceiptExtractionAdapter } from '#infrastructure/settings/gemini-receipt-extraction.adapter'
import { OllamaReceiptExtractionAdapter } from '#infrastructure/settings/ollama-receipt-extraction.adapter'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { AiProvider } from '#domain/settings/ai-provider.vo'

function fakeSettings(provider: AiProvider): AiSettingsProvider {
  return {
    async resolveEffective() {
      return { activeProvider: provider, source: 'environment', availableProviders: [provider] }
    },
  }
}

test.group('resolveReceiptExtractionAdapter (ai-provider-registry)', () => {
  test('returns the same adapter instance when the provider is unchanged', async ({ assert }) => {
    const settings = fakeSettings('gemini')
    const first = await resolveReceiptExtractionAdapter(settings)
    const second = await resolveReceiptExtractionAdapter(settings)
    assert.strictEqual(first, second)
    assert.instanceOf(first, GeminiReceiptExtractionAdapter)
  })

  test('rebuilds the adapter when the provider changes', async ({ assert }) => {
    await resolveReceiptExtractionAdapter(fakeSettings('gemini'))
    const afterSwitch = await resolveReceiptExtractionAdapter(fakeSettings('ollama'))
    assert.instanceOf(afterSwitch, OllamaReceiptExtractionAdapter)
  })
})
