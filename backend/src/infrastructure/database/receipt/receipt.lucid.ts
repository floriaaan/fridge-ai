import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class ReceiptModel extends BaseModel {
  static table = 'receipt'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'store_name' })
  declare storeName: string

  @column.dateTime({ columnName: 'scanned_at' })
  declare scannedAt: DateTime

  @column({ columnName: 'total_amount' })
  declare totalAmount: number

  @column({ columnName: 'image_key' })
  declare imageKey: string | null

  @column({ columnName: 'items_count' })
  declare itemsCount: number

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
