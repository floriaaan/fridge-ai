import type { ApplicationService } from '@adonisjs/core/types'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'

export default class ShoppingListProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('shoppingList.items', async () => {
      const { LucidShoppingItemRepository } =
        await import('#infrastructure/database/shopping-list/shopping-item.repository')
      return new LucidShoppingItemRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'shoppingList.items': ShoppingItemRepository
  }
}
