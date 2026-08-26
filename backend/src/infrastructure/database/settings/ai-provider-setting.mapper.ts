import { AiProviderSettings } from '#domain/settings/ai-provider-settings.aggregate'
import type AiProviderSettingModel from './ai-provider-setting.lucid.js'

export function toDomain(row: AiProviderSettingModel): AiProviderSettings {
  return AiProviderSettings.reconstruct(row.id, {
    activeProvider: row.activeProvider,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toJSDate(),
  })
}
