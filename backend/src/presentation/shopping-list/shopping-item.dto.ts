import type { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'

export interface ShoppingItemDto {
  id: string
  name: string
  quantity: { amount: number; unit: string }
  checked: boolean
  source: string
  createdAt: string
  updatedAt: string
}

export function toShoppingItemDto(item: ShoppingItem): ShoppingItemDto {
  return {
    id: item.id,
    name: item.name,
    quantity: { amount: item.quantity.amount, unit: item.quantity.unit },
    checked: item.checked,
    source: item.source.value,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}
