import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { LocationValue } from '#domain/fridge/location.vo'
import type { OutcomeKindValue } from '#domain/fridge/outcome-kind.vo'
import type { DiscardReasonValue } from '#domain/fridge/discard-reason.vo'

export default class ProductOutcomeModel extends BaseModel {
  static table = 'product_outcome'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'product_id' })
  declare productId: string

  @column({ columnName: 'recorded_by' })
  declare recordedBy: string | null

  @column({ columnName: 'recipe_id' })
  declare recipeId: string | null

  @column()
  declare kind: OutcomeKindValue

  @column({ columnName: 'discard_reason' })
  declare discardReason: DiscardReasonValue | null

  @column({ columnName: 'product_name' })
  declare productName: string

  @column()
  declare category: string

  @column()
  declare categories: string[] | null

  @column()
  declare location: LocationValue

  @column()
  declare amount: number

  @column()
  declare unit: string

  @column()
  declare price: number | null

  @column.dateTime({ columnName: 'expires_at' })
  declare expiresAt: DateTime | null

  @column.dateTime({ columnName: 'occurred_at' })
  declare occurredAt: DateTime
}
