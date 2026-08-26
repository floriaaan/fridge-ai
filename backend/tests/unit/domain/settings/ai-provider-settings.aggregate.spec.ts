import { test } from '@japa/runner'
import { AiProviderSettings } from '#domain/settings/ai-provider-settings.aggregate'

test.group('AiProviderSettings', () => {
  test('seedFromEnv() sets the default provider with no updatedBy', ({ assert }) => {
    const settings = AiProviderSettings.seedFromEnv('s_1', 'gemini', new Date('2026-08-26T10:00:00Z'))
    assert.equal(settings.activeProvider, 'gemini')
    assert.isNull(settings.updatedBy)
  })

  test('changeProvider() updates the active provider and audit fields', ({ assert }) => {
    const settings = AiProviderSettings.seedFromEnv('s_1', 'gemini', new Date('2026-08-26T10:00:00Z'))
    settings.changeProvider('ollama', 'u_owner', new Date('2026-08-26T11:00:00Z'))
    assert.equal(settings.activeProvider, 'ollama')
    assert.equal(settings.updatedBy, 'u_owner')
    assert.equal(settings.updatedAt.toISOString(), '2026-08-26T11:00:00.000Z')
  })
})
