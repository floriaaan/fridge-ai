import type { RecipeDraft } from '../recipe-draft.js'

export interface RecipeGenerationProduct {
  name: string
  category: string
  expiresAt: Date | null
}

export interface RecipeGenerationContext {
  products: RecipeGenerationProduct[]
  prompt?: string
  prioritizeExpiringSoon: boolean
}

export interface RecipeGenerationPort {
  generate(context: RecipeGenerationContext): Promise<RecipeDraft[]>
}
