import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { ShoppingItemSourceValue } from '#domain/shopping-list/shopping-item-source.vo'

export default class ShoppingItemModel extends BaseModel {
  static table = 'shopping_item'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column()
  declare name: string

  @column()
  declare quantity: number

  @column()
  declare unit: string

  @column()
  declare checked: boolean

  @column()
  declare source: ShoppingItemSourceValue

  @column({ columnName: 'ha_uid' })
  declare haUid: string | null

  @column.dateTime({ columnName: 'ha_synced_at' })
  declare haSyncedAt: DateTime | null

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
