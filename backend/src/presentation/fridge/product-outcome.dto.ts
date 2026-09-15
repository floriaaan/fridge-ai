import type { ProductOutcome } from '#domain/fridge/product-outcome.entity'

export interface ProductOutcomeDto {
  id: string
  productId: string
  recordedBy: string | null
  recipeId: string | null
  kind: string
  discardReason: string | null
  productName: string
  category: string
  categories: string[] | null
  location: string
  quantity: { amount: number; unit: string }
  price: number | null
  expiresAt: string | null
  occurredAt: string
}

export function toProductOutcomeDto(outcome: ProductOutcome): ProductOutcomeDto {
  return {
    id: outcome.id,
    productId: outcome.productId,
    recordedBy: outcome.recordedBy,
    recipeId: outcome.recipeId,
    kind: outcome.kind.value,
    discardReason: outcome.discardReason?.value ?? null,
    productName: outcome.productName,
    category: outcome.category,
    categories: outcome.categories,
    location: outcome.location.value,
    quantity: { amount: outcome.quantity.amount, unit: outcome.quantity.unit },
    price: outcome.price,
    expiresAt: outcome.expiresAt?.toISOString() ?? null,
    occurredAt: outcome.occurredAt.toISOString(),
  }
}
