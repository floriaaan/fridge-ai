import ShoppingItemModel from './shopping-item.lucid.js'
import { toDomain } from './shopping-item.mapper.js'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'

export class LucidShoppingItemRepository implements ShoppingItemRepository {
  async findById(id: string): Promise<ShoppingItem | null> {
    const row = await ShoppingItemModel.find(id)
    return row ? toDomain(row) : null
  }

  async findByHousehold(householdId: string): Promise<ShoppingItem[]> {
    const rows = await ShoppingItemModel.query()
      .where('household_id', householdId)
      .orderBy('created_at', 'asc')
    return rows.map(toDomain)
  }

  async save(item: ShoppingItem): Promise<void> {
    await ShoppingItemModel.updateOrCreate(
      { id: item.id },
      {
        householdId: item.householdId,
        name: item.name,
        quantity: item.quantity.amount,
        unit: item.quantity.unit,
        checked: item.checked,
        source: item.source.value,
      },
    )
  }

  async delete(id: string): Promise<void> {
    await ShoppingItemModel.query().where('id', id).delete()
  }
}
