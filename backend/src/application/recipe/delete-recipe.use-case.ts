import type { UseCase } from '#application/shared/use-case'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface DeleteRecipeInput {
  householdId: string
  recipeId: string
}

export type DeleteRecipeError = 'recipe_not_found'

export class DeleteRecipe implements UseCase<
  DeleteRecipeInput,
  ResultType<void, DeleteRecipeError>
> {
  constructor(private readonly recipes: RecipeRepository) {}

  async execute(input: DeleteRecipeInput): Promise<ResultType<void, DeleteRecipeError>> {
    const recipe = await this.recipes.findById(input.recipeId)
    if (!recipe || recipe.householdId !== input.householdId) return Result.err('recipe_not_found')
    await this.recipes.delete(recipe.id)
    return Result.ok(undefined)
  }
}
