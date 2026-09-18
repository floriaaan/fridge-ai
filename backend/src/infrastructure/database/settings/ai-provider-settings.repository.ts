import AiProviderSettingModel from './ai-provider-setting.lucid.js'
import { toDomain } from './ai-provider-setting.mapper.js'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { AiProviderSettings } from '#domain/settings/ai-provider-settings.aggregate'

/** One row per household — `household_id` is unique (cf. the 2026-09-18 migration). */
export class LucidAiProviderSettingsRepository implements AiProviderSettingsRepository {
  async find(householdId: string): Promise<AiProviderSettings | null> {
    const row = await AiProviderSettingModel.query().where('household_id', householdId).first()
    return row ? toDomain(row) : null
  }

  async save(settings: AiProviderSettings): Promise<void> {
    await AiProviderSettingModel.updateOrCreate(
      { householdId: settings.householdId },
      {
        id: settings.id,
        activeProvider: settings.activeProvider,
        updatedBy: settings.updatedBy,
      },
    )
  }
}
