import type { ApplicationService } from '@adonisjs/core/types'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'

export default class RecipeProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('recipe.recipes', async () => {
      const { LucidRecipeRepository } =
        await import('#infrastructure/database/recipe/recipe.repository')
      return new LucidRecipeRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'recipe.recipes': RecipeRepository
  }
}
