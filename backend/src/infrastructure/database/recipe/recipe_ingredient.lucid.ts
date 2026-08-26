import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class RecipeIngredientModel extends BaseModel {
  static table = 'recipe_ingredient'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'recipe_id' })
  declare recipeId: string

  @column({ columnName: 'product_id' })
  declare productId: string | null

  @column()
  declare label: string

  @column()
  declare quantity: number | null

  @column()
  declare unit: string | null

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime
}
