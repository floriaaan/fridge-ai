import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { LocationValue } from '#domain/fridge/location.vo'

export default class ProductModel extends BaseModel {
  static table = 'product'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'receipt_id' })
  declare receiptId: string | null

  @column()
  declare name: string

  @column()
  declare quantity: number

  @column()
  declare unit: string

  @column()
  declare location: LocationValue

  @column.dateTime({ columnName: 'expires_at' })
  declare expiresAt: DateTime | null

  @column.dateTime({ columnName: 'opened_at' })
  declare openedAt: DateTime | null

  @column()
  declare category: string

  @column({ columnName: 'openfoodfact_id' })
  declare openfoodfactId: string | null

  @column()
  declare categories: string[] | null

  @column()
  declare price: number | null

  @column({ columnName: 'image_key' })
  declare imageKey: string | null

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
