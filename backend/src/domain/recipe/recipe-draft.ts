/** Never persisted as-is — one element of the raw result of `RecipeGenerationPort.generate()`. */
export interface RecipeDraftIngredient {
  label: string
  productId: string | null
  quantity: number | null
  unit: string | null
}

export interface RecipeDraft {
  title: string
  description: string | null
  instructions: string
  preparationTime: number | null
  tags: string[]
  ingredients: RecipeDraftIngredient[]
}
