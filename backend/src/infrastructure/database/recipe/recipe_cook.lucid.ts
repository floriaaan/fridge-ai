import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class RecipeCookModel extends BaseModel {
  static table = 'recipe_cook'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'recipe_id' })
  declare recipeId: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'cooked_by' })
  declare cookedBy: string | null

  @column({ columnName: 'products_used' })
  declare productsUsed: number

  @column.dateTime({ columnName: 'cooked_at' })
  declare cookedAt: DateTime
}
