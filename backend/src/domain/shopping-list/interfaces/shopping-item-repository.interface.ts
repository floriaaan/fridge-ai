import type { ShoppingItem } from '../shopping-item.entity.js'

export interface ShoppingItemRepository {
  findById(id: string): Promise<ShoppingItem | null>
  findByHousehold(householdId: string): Promise<ShoppingItem[]>
  save(item: ShoppingItem): Promise<void>
  delete(id: string): Promise<void>
}
