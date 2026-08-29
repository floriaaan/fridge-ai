/** Mirrors `ReceiptDraftDto` (`backend/src/presentation/receipt/receipt.dto.ts`) field-for-field. */
export interface ReceiptDraftItem {
  name: string
  quantity: number
  unit: string
  category: string | null
  price: number | null
}

export interface ReceiptDraft {
  storeName: string
  scannedAt: string
  totalAmount: number
  items: ReceiptDraftItem[]
}
