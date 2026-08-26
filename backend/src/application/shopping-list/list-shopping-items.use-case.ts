import type { UseCase } from '#application/shared/use-case'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'

export interface ListShoppingItemsInput {
  householdId: string
}

export class ListShoppingItems implements UseCase<ListShoppingItemsInput, ShoppingItem[]> {
  constructor(private readonly items: ShoppingItemRepository) {}

  async execute(input: ListShoppingItemsInput): Promise<ShoppingItem[]> {
    return this.items.findByHousehold(input.householdId)
  }
}
