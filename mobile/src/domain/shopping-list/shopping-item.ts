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

/** Mirrors `createShoppingItemValidator` field-for-field. `source` is never client-supplied — the backend fixes it to `'manual'`. */
export interface CreateShoppingItemInput {
  name: string
  quantity: { amount: number; unit: string }
}

/** Mirrors `updateShoppingItemValidator` — any subset of fields, same shape `updateProduct`'s patch already uses. */
export interface UpdateShoppingItemInput {
  name?: string
  quantity?: { amount: number; unit: string }
  checked?: boolean
}
