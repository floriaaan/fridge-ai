import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { SyncDirectionValue } from '#domain/home-assistant/sync-direction.vo'

export default class HomeAssistantLinkModel extends BaseModel {
  static table = 'home_assistant_link'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'instance_url' })
  declare instanceUrl: string

  @column({ columnName: 'encrypted_token' })
  declare encryptedToken: string

  @column({ columnName: 'todo_entity_id' })
  declare todoEntityId: string | null

  @column({ columnName: 'todo_entity_name' })
  declare todoEntityName: string | null

  @column()
  declare direction: SyncDirectionValue

  @column()
  declare enabled: boolean

  @column.dateTime({ columnName: 'last_sync_at' })
  declare lastSyncAt: DateTime | null

  @column({ columnName: 'last_error' })
  declare lastError: string | null

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
