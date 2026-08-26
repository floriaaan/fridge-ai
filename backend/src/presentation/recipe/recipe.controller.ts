import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { generateRecipesValidator, saveRecipeValidator } from './recipe.validator.js'
import { toRecipeDto, toRecipeDraftDto } from './recipe.dto.js'
import { GenerateRecipes } from '#application/recipe/generate-recipes.use-case'
import { SuggestRecipes } from '#application/recipe/suggest-recipes.use-case'
import { SaveRecipe } from '#application/recipe/save-recipe.use-case'
import { ListRecipes } from '#application/recipe/list-recipes.use-case'
import { ShowRecipe } from '#application/recipe/show-recipe.use-case'
import { DeleteRecipe } from '#application/recipe/delete-recipe.use-case'

export default class RecipeController {
  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const recipes = await ctx.containerResolver.make('recipe.recipes')
    const result = await new ListRecipes(recipes).execute({ householdId: ctx.household.id })
    return ctx.response.json({ recipes: result.map(toRecipeDto) })
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const recipes = await ctx.containerResolver.make('recipe.recipes')
    const recipe = await new ShowRecipe(recipes).execute({
      householdId: ctx.household.id,
      recipeId: ctx.params.id,
    })
    if (!recipe) {
      const { status, body } = serializeError('recipe_not_found')
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ recipe: toRecipeDto(recipe) })
  }

  async generate(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const { prompt } = await ctx.request.validateUsing(generateRecipesValidator)
    const recipes = await ctx.containerResolver.make('recipe.recipes')
    const products = await ctx.containerResolver.make('fridge.products')
    const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
    const clock = await ctx.containerResolver.make('shared.clock')
    const resolveGeneration = await ctx.containerResolver.make(
      'settings.resolveRecipeGenerationPort',
    )
    const generation = await resolveGeneration()

    const result = await new GenerateRecipes(
      recipes,
      products,
      generation,
      idGenerator,
      clock,
    ).execute({ householdId: ctx.household.id, prompt })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(201).json({ recipes: result.value.map(toRecipeDto) })
  }

  async suggestions(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const products = await ctx.containerResolver.make('fridge.products')
    const resolveGeneration = await ctx.containerResolver.make(
      'settings.resolveRecipeGenerationPort',
    )
    const generation = await resolveGeneration()

    const result = await new SuggestRecipes(products, generation).execute({
      householdId: ctx.household.id,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ recipes: result.value.map(toRecipeDraftDto) })
  }

  async store(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const payload = await ctx.request.validateUsing(saveRecipeValidator)
    const recipes = await ctx.containerResolver.make('recipe.recipes')
    const products = await ctx.containerResolver.make('fridge.products')
    const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
    const clock = await ctx.containerResolver.make('shared.clock')

    const result = await new SaveRecipe(recipes, products, idGenerator, clock).execute({
      householdId: ctx.household.id,
      ...payload,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(201).json({ recipe: toRecipeDto(result.value) })
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const recipes = await ctx.containerResolver.make('recipe.recipes')
    const result = await new DeleteRecipe(recipes).execute({
      householdId: ctx.household.id,
      recipeId: ctx.params.id,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(204).send('')
  }
}
