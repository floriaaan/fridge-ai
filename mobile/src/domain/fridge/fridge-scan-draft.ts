import type { LocationValue } from './location.js'

/** Mirrors `FridgeScanDraftDto` (`backend/src/presentation/fridge/fridge-scan.dto.ts`) field-for-field. */
export interface FridgeScanDraftItem {
  name: string
  quantity: number
  unit: string
  category: string | null
  location: LocationValue
  /** The AI's own estimate of days-until-expiry from today — `null` when it has no reasonable guess. Pre-fills, never overrides, the editable date. */
  expiresInDays: number | null
}

export interface FridgeScanDraft {
  items: FridgeScanDraftItem[]
}

/** Mirrors `importProductsValidator` (`backend/src/presentation/fridge/product.validator.ts`). */
export interface ImportProductsItemInput {
  name: string
  quantity: number
  unit: string
  category?: string | null
  location: LocationValue
  expiresAt?: string | null
}
