/** Mirrors `ReceiptDraftDto` (`backend/src/presentation/receipt/receipt.dto.ts`) field-for-field. */
export interface ReceiptDraftItem {
  name: string
  quantity: number
  unit: string
  category: string | null
  price: number | null
  /** The AI's own estimate of days-until-expiry from the purchase date — `null` when it has no reasonable guess. Pre-fills, never overrides, the editable date. */
  expiresInDays: number | null
}

export interface ReceiptDraft {
  storeName: string
  scannedAt: string
  totalAmount: number
  items: ReceiptDraftItem[]
}
