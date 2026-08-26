import type { UseCase } from '#application/shared/use-case'
import type { RecipeGenerationPort } from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'
import {
  RecipeGenerationUnavailableError,
  RecipeGenerationParseError,
} from '#domain/recipe/recipe-generation.errors'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface SuggestRecipesInput {
  householdId: string
}

export type SuggestRecipesError = 'provider_not_configured' | 'generation_failed'

/** Never persists — `POST /api/recipes` (SaveRecipe) is how a suggestion gets kept. */
export class SuggestRecipes implements UseCase<
  SuggestRecipesInput,
  ResultType<RecipeDraft[], SuggestRecipesError>
> {
  constructor(
    private readonly products: ProductRepository,
    private readonly generation: RecipeGenerationPort,
  ) {}

  async execute(
    input: SuggestRecipesInput,
  ): Promise<ResultType<RecipeDraft[], SuggestRecipesError>> {
    const householdProducts = await this.products.findByHousehold(input.householdId)

    try {
      const drafts = await this.generation.generate({
        products: householdProducts.map((p) => ({
          name: p.name,
          category: p.category,
          expiresAt: p.expiresAt,
        })),
        prioritizeExpiringSoon: true,
      })
      return Result.ok(drafts)
    } catch (error) {
      if (error instanceof RecipeGenerationUnavailableError)
        return Result.err('provider_not_configured')
      if (error instanceof RecipeGenerationParseError) return Result.err('generation_failed')
      throw error
    }
  }
}
