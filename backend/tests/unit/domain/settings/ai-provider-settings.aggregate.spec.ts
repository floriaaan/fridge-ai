import { test } from '@japa/runner'
import { AiProviderSettings } from '#domain/settings/ai-provider-settings.aggregate'
import { parseAllowedProviders } from '#domain/settings/ai-provider.vo'

test.group('AiProviderSettings', () => {
  test('seedFromEnv() sets the default provider with no updatedBy', ({ assert }) => {
    const settings = AiProviderSettings.seedFromEnv(
      's_1',
      'h_1',
      'gemini',
      new Date('2026-08-26T10:00:00Z'),
    )
    assert.equal(settings.householdId, 'h_1')
    assert.equal(settings.activeProvider, 'gemini')
    assert.isNull(settings.updatedBy)
  })

  test('changeProvider() updates the active provider and audit fields', ({ assert }) => {
    const settings = AiProviderSettings.seedFromEnv(
      's_1',
      'h_1',
      'gemini',
      new Date('2026-08-26T10:00:00Z'),
    )
    settings.changeProvider('ollama', 'u_owner', new Date('2026-08-26T11:00:00Z'))
    assert.equal(settings.activeProvider, 'ollama')
    assert.equal(settings.householdId, 'h_1')
    assert.equal(settings.updatedBy, 'u_owner')
    assert.equal(settings.updatedAt.toISOString(), '2026-08-26T11:00:00.000Z')
  })
})

test.group('parseAllowedProviders', () => {
  test('reads a comma-separated list, order preserved', ({ assert }) => {
    assert.deepEqual([...parseAllowedProviders('ollama, gemini')], ['ollama', 'gemini'])
  })

  test('still reads the pre-list single-value form', ({ assert }) => {
    assert.deepEqual([...parseAllowedProviders('gemini')], ['gemini'])
  })

  test('unset means every provider', ({ assert }) => {
    assert.deepEqual([...parseAllowedProviders('')], ['gemini', 'openai', 'ollama'])
  })

  test('throws on an unknown entry rather than silently dropping it', ({ assert }) => {
    assert.throws(() => parseAllowedProviders('gemini,gemeni'), /unknown provider "gemeni"/)
  })
})
