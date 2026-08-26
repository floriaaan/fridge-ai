import db from '@adonisjs/lucid/services/db'
import RecipeModel from './recipe.lucid.js'
import RecipeIngredientModel from './recipe_ingredient.lucid.js'
import { toDomain } from './recipe.mapper.js'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { Recipe } from '#domain/recipe/recipe.aggregate'

/**
 * Persists the aggregate + its internal `RecipeIngredient` entities in one
 * transaction, diffing removed ingredient rows — same pattern as
 * `LucidHouseholdRepository.save()` for `Household`/`HouseholdMember`.
 */
export class LucidRecipeRepository implements RecipeRepository {
  async findById(id: string): Promise<Recipe | null> {
    const row = await RecipeModel.query().where('id', id).preload('ingredients').first()
    return row ? toDomain(row) : null
  }

  async findByHousehold(householdId: string): Promise<Recipe[]> {
    const rows = await RecipeModel.query()
      .where('household_id', householdId)
      .preload('ingredients')
      .orderBy('created_at', 'desc')
    return rows.map(toDomain)
  }

  async save(recipe: Recipe): Promise<void> {
    await db.transaction(async (trx) => {
      await RecipeModel.updateOrCreate(
        { id: recipe.id },
        {
          householdId: recipe.householdId,
          title: recipe.title,
          description: recipe.description,
          source: recipe.source.value,
          instructions: recipe.instructions,
          preparationTime: recipe.preparationTime,
          tags: recipe.tags,
          imageKey: recipe.imageKey,
        },
        { client: trx },
      )

      const existingRows = await RecipeIngredientModel.query({ client: trx }).where(
        'recipe_id',
        recipe.id,
      )
      const currentIds = new Set(recipe.ingredients.map((i) => i.id))

      const removedIds = existingRows.filter((row) => !currentIds.has(row.id)).map((row) => row.id)
      if (removedIds.length > 0) {
        await RecipeIngredientModel.query({ client: trx }).whereIn('id', removedIds).delete()
      }

      for (const ingredient of recipe.ingredients) {
        await RecipeIngredientModel.updateOrCreate(
          { id: ingredient.id },
          {
            recipeId: ingredient.recipeId,
            productId: ingredient.productId,
            label: ingredient.label,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          },
          { client: trx },
        )
      }
    })
  }

  async delete(id: string): Promise<void> {
    await RecipeModel.query().where('id', id).delete()
  }
}
