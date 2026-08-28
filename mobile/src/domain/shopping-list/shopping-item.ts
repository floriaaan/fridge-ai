/** Structurally identical to the backend's `ShoppingItemDto` (`shopping-item.dto.ts`) — no re-mapping on this side. */
export interface ShoppingItem {
  id: string
  name: string
  quantity: { amount: number; unit: string }
  checked: boolean
  source: string
  createdAt: string
  updatedAt: string
}
