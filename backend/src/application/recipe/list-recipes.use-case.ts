import type { UseCase } from '#application/shared/use-case'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { Recipe } from '#domain/recipe/recipe.aggregate'

export interface ListRecipesInput {
  householdId: string
}

export class ListRecipes implements UseCase<ListRecipesInput, Recipe[]> {
  constructor(private readonly recipes: RecipeRepository) {}

  async execute(input: ListRecipesInput): Promise<Recipe[]> {
    return this.recipes.findByHousehold(input.householdId)
  }
}
