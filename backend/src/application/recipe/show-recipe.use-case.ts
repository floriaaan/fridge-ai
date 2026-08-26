import type { UseCase } from '#application/shared/use-case'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { Recipe } from '#domain/recipe/recipe.aggregate'

export interface ShowRecipeInput {
  householdId: string
  recipeId: string
}

export class ShowRecipe implements UseCase<ShowRecipeInput, Recipe | null> {
  constructor(private readonly recipes: RecipeRepository) {}

  async execute(input: ShowRecipeInput): Promise<Recipe | null> {
    const recipe = await this.recipes.findById(input.recipeId)
    if (!recipe || recipe.householdId !== input.householdId) return null
    return recipe
  }
}
