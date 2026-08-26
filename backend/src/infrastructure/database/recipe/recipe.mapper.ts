import { Recipe } from '#domain/recipe/recipe.aggregate'
import { RecipeIngredient } from '#domain/recipe/recipe-ingredient.entity'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'
import type RecipeModel from './recipe.lucid.js'

export function toDomain(row: RecipeModel): Recipe {
  const source = RecipeSource.create(row.source)
  if (!source.ok) throw new Error(`Corrupted recipe row ${row.id}: ${source.error.message}`)

  const ingredients = row.ingredients.map((i) =>
    RecipeIngredient.create(i.id, {
      recipeId: i.recipeId,
      productId: i.productId,
      label: i.label,
      quantity: i.quantity,
      unit: i.unit,
    }),
  )

  return Recipe.reconstruct(row.id, {
    householdId: row.householdId,
    title: row.title,
    description: row.description,
    source: source.value,
    instructions: row.instructions,
    preparationTime: row.preparationTime,
    tags: row.tags,
    imageKey: row.imageKey,
    ingredients,
    createdAt: row.createdAt.toJSDate(),
  })
}
