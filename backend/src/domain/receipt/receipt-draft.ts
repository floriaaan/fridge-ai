/** Never persisted as-is — the raw result of `ReceiptExtractionPort.extract()`. */
export interface ReceiptDraftItem {
  name: string
  quantity: number
  unit: string
  category: string | null
  price: number | null
}

export interface ReceiptDraft {
  storeName: string
  scannedAt: Date
  totalAmount: number
  items: ReceiptDraftItem[]
}
