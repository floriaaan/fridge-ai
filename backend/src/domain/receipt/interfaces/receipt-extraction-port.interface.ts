import type { ReceiptDraft } from '../receipt-draft.js'

export interface ReceiptExtractionPort {
  extract(image: Buffer): Promise<ReceiptDraft>
}
