import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import type ShoppingItemModel from './shopping-item.lucid.js'

export function toDomain(row: ShoppingItemModel): ShoppingItem {
  const quantity = Quantity.create(row.quantity, row.unit)
  if (!quantity.ok)
    throw new Error(`Corrupted shopping_item row ${row.id}: ${quantity.error.message}`)

  const source = ShoppingItemSource.create(row.source)
  if (!source.ok) throw new Error(`Corrupted shopping_item row ${row.id}: ${source.error.message}`)

  return ShoppingItem.reconstruct(row.id, {
    householdId: row.householdId,
    name: row.name,
    quantity: quantity.value,
    checked: row.checked,
    source: source.value,
    createdAt: row.createdAt.toJSDate(),
    updatedAt: row.updatedAt.toJSDate(),
  })
}
