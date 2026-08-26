import type { Recipe } from '../recipe.aggregate.js'

export interface RecipeRepository {
  findById(id: string): Promise<Recipe | null>
  findByHousehold(householdId: string): Promise<Recipe[]>
  save(recipe: Recipe): Promise<void>
  delete(id: string): Promise<void>
}
