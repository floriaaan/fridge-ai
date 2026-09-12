/** Never persisted as-is — the raw result of `ReceiptExtractionPort.extract()`. */
export interface ReceiptDraftItem {
  name: string
  quantity: number
  unit: string
  category: string | null
  price: number | null
  /** The model's own estimate of days-until-expiry from the purchase date — see `receipt-extraction-prompt.ts`. `null` when it has no reasonable guess. */
  expiresInDays: number | null
}

export interface ReceiptDraft {
  storeName: string
  scannedAt: Date
  totalAmount: number
  items: ReceiptDraftItem[]
}
