import type { ApplicationService } from '@adonisjs/core/types'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { ProductLookupPort } from '#domain/fridge/interfaces/product-lookup-port.interface'
import type { ProductOutcomeStatsPort } from '#domain/fridge/interfaces/product-outcome-stats.interface'

export default class FridgeProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('fridge.products', async () => {
      const { LucidProductRepository } =
        await import('#infrastructure/database/fridge/product.repository')
      return new LucidProductRepository()
    })

    this.app.container.singleton('fridge.productLookup', async () => {
      const { OpenFoodFactsAdapter } = await import('#infrastructure/fridge/openfoodfacts-adapter')
      return new OpenFoodFactsAdapter()
    })

    this.app.container.singleton('fridge.outcomeStats', async () => {
      const { LucidProductOutcomeStatsAdapter } =
        await import('#infrastructure/database/fridge/product-outcome-stats.adapter')
      return new LucidProductOutcomeStatsAdapter()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'fridge.products': ProductRepository
    'fridge.productLookup': ProductLookupPort
    'fridge.outcomeStats': ProductOutcomeStatsPort
  }
}
