import AiProviderSettingModel from './ai-provider-setting.lucid.js'
import { toDomain } from './ai-provider-setting.mapper.js'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { AiProviderSettings } from '#domain/settings/ai-provider-settings.aggregate'

/**
 * Singleton table — `find()` reads the only row if one exists (upsert on
 * `save()` keyed by the aggregate's own id, cf. docs/phase-0/03-schema-base-de-donnees.md's
 * note: uniqueness is applicative, not a DB constraint).
 */
export class LucidAiProviderSettingsRepository implements AiProviderSettingsRepository {
  async find(): Promise<AiProviderSettings | null> {
    const row = await AiProviderSettingModel.query().first()
    return row ? toDomain(row) : null
  }

  async save(settings: AiProviderSettings): Promise<void> {
    await AiProviderSettingModel.updateOrCreate(
      { id: settings.id },
      { activeProvider: settings.activeProvider, updatedBy: settings.updatedBy },
    )
  }
}
