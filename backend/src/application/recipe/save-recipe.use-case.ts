import type { UseCase } from '#application/shared/use-case'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Recipe } from '#domain/recipe/recipe.aggregate'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface SaveRecipeIngredientInput {
  label: string
  productId?: string | null
  quantity?: number | null
  unit?: string | null
}

export interface SaveRecipeInput {
  householdId: string
  title: string
  source: string
  instructions: string
  ingredients: SaveRecipeIngredientInput[]
  description?: string | null
  preparationTime?: number | null
  tags?: string[]
}

export class SaveRecipe implements UseCase<SaveRecipeInput, ResultType<Recipe, ValidationError>> {
  constructor(
    private readonly recipes: RecipeRepository,
    private readonly products: ProductRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: SaveRecipeInput): Promise<ResultType<Recipe, ValidationError>> {
    const source = RecipeSource.create(input.source)
    if (!source.ok) return source

    // A client-supplied `productId` reaches a real FK column
    // (`recipe_ingredient.product_id` -> `product(id)`) — validate it
    // exists and belongs to the caller's household before building the
    // aggregate, rather than letting a bad id 500 on the FK violation or a
    // valid-but-foreign id get silently persisted.
    for (const ingredient of input.ingredients) {
      if (!ingredient.productId) continue
      const product = await this.products.findById(ingredient.productId)
      if (!product || product.householdId !== input.householdId) {
        return Result.err({ field: 'productId', message: 'Produit introuvable.' })
      }
    }

    const recipe = Recipe.create({
      id: this.idGenerator.next(),
      householdId: input.householdId,
      title: input.title,
      source: source.value,
      instructions: input.instructions,
      description: input.description ?? null,
      preparationTime:
        input.preparationTime !== null && input.preparationTime !== undefined
          ? Math.round(input.preparationTime)
          : null,
      tags: input.tags ?? [],
      ingredients: input.ingredients.map((i) => ({
        id: this.idGenerator.next(),
        productId: i.productId ?? null,
        label: i.label,
        // `recipe_ingredient.quantity` is an INTEGER column (docs/phase-0/03)
        // — round client-supplied values the same way the AI parser does
        // (Task 4), rather than letting a fractional value reach the DB as
        // an unhandled type error.
        quantity: i.quantity !== null && i.quantity !== undefined ? Math.round(i.quantity) : null,
        unit: i.unit ?? null,
      })),
      createdAt: this.clock.now(),
    })

    await this.recipes.save(recipe)
    return Result.ok(recipe)
  }
}
