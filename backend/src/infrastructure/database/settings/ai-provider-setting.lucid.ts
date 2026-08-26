import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { AiProvider } from '#domain/settings/ai-provider.vo'

export default class AiProviderSettingModel extends BaseModel {
  static table = 'ai_provider_setting'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'active_provider' })
  declare activeProvider: AiProvider

  @column({ columnName: 'updated_by' })
  declare updatedBy: string | null

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
