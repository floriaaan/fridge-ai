/** Structurally identical to the backend's `RecipeDto`/`RecipeIngredientDto` (`recipe.dto.ts`) — no re-mapping on this side. */
export interface RecipeIngredient {
  id: string
  productId: string | null
  label: string
  quantity: number | null
  unit: string | null
}

export interface Recipe {
  id: string
  title: string
  description: string | null
  source: string
  instructions: string
  preparationTime: number | null
  tags: string[]
  imageKey: string | null
  ingredients: RecipeIngredient[]
  createdAt: string
}
