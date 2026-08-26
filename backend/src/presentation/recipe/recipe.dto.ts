import type { Recipe } from '#domain/recipe/recipe.aggregate'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'

export interface RecipeIngredientDto {
  id: string
  productId: string | null
  label: string
  quantity: number | null
  unit: string | null
}

export interface RecipeDto {
  id: string
  title: string
  description: string | null
  source: string
  instructions: string
  preparationTime: number | null
  tags: string[]
  imageKey: string | null
  ingredients: RecipeIngredientDto[]
  createdAt: string
}

export interface RecipeDraftDto {
  title: string
  description: string | null
  instructions: string
  preparationTime: number | null
  tags: string[]
  ingredients: {
    label: string
    productId: string | null
    quantity: number | null
    unit: string | null
  }[]
}

export function toRecipeDto(recipe: Recipe): RecipeDto {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    source: recipe.source.value,
    instructions: recipe.instructions,
    preparationTime: recipe.preparationTime,
    tags: recipe.tags,
    imageKey: recipe.imageKey,
    ingredients: recipe.ingredients.map((i) => ({
      id: i.id,
      productId: i.productId,
      label: i.label,
      quantity: i.quantity,
      unit: i.unit,
    })),
    createdAt: recipe.createdAt.toISOString(),
  }
}

export function toRecipeDraftDto(draft: RecipeDraft): RecipeDraftDto {
  return {
    title: draft.title,
    description: draft.description,
    instructions: draft.instructions,
    preparationTime: draft.preparationTime,
    tags: draft.tags,
    ingredients: draft.ingredients,
  }
}
