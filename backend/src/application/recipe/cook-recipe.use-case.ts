import type { UseCase } from '#application/shared/use-case'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import type { Recipe } from '#domain/recipe/recipe.aggregate'

export interface CookRecipeInput {
  householdId: string
  userId: string
  recipeId: string
  /**
   * The garde-manger products this meal used up.
   *
   * The client sends them because the client is where the rapprochement
   * happens: the generator never links an ingredient to a real product (see
   * `recipe-draft-parser.ts`, which refuses to guess a foreign key), so the
   * only place that knows "these épinards are the ones this recipe meant" is
   * the screen where a person confirmed it. Empty is legitimate — "j'ai
   * cuisiné" is worth recording even when nothing left the fridge.
   */
  productIds: string[]
}

export type CookRecipeError = 'recipe_not_found'

/**
 * Closing the anti-gaspi loop.
 *
 * The app recommended a dish to save a product about to expire and had no way
 * to hear that it worked — so it recommended the same dish for the same
 * product the next evening, while the dashboard's overdue count climbed. This
 * is the missing half: it writes down that the foyer cooked it, and takes the
 * products the meal consumed out of the garde-manger, which is the only thing
 * that makes the counts fall for the right reason.
 *
 * A product is only consumed when it belongs to the same household. A recipe
 * id from one foyer must never reach into another's fridge, and an id that is
 * simply stale (someone else finished the spinach first) is skipped rather
 * than failing the whole meal — the cook already happened.
 */
export class CookRecipe implements UseCase<CookRecipeInput, ResultType<Recipe, CookRecipeError>> {
  constructor(
    private readonly recipes: RecipeRepository,
    private readonly products: ProductRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: CookRecipeInput): Promise<ResultType<Recipe, CookRecipeError>> {
    const recipe = await this.recipes.findById(input.recipeId)
    if (!recipe || recipe.householdId !== input.householdId) return Result.err('recipe_not_found')

    let consumed = 0
    for (const productId of new Set(input.productIds)) {
      const product = await this.products.findById(productId)
      if (!product || product.householdId !== input.householdId) continue
      await this.products.delete(product.id)
      consumed += 1
    }

    await this.recipes.recordCook({
      id: this.idGenerator.next(),
      recipeId: recipe.id,
      householdId: input.householdId,
      userId: input.userId,
      productsUsed: consumed,
      at: this.clock.now(),
    })

    // Re-read so the response carries the count the client is about to render,
    // rather than the one it had a moment ago.
    const updated = await this.recipes.findById(recipe.id)
    return Result.ok(updated ?? recipe)
  }
}
