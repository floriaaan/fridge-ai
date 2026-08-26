import type { ApplicationService } from '@adonisjs/core/types'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'

export default class FridgeProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('fridge.products', async () => {
      const { LucidProductRepository } = await import('#infrastructure/database/fridge/product.repository')
      return new LucidProductRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'fridge.products': ProductRepository
  }
}
