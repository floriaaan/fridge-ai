import type { ReceiptDraft } from '../../../domain/receipt/receipt-draft.js'

export const fakeReceiptDraft: ReceiptDraft = {
  storeName: 'Carrefour',
  scannedAt: '2026-08-28T10:00:00.000Z',
  totalAmount: 24.5,
  items: [
    { name: 'Lait demi-écrémé', quantity: 2, unit: 'L', category: 'Produits laitiers', price: 2.4 },
    { name: 'Pain de mie', quantity: 1, unit: 'pièce', category: 'Boulangerie', price: 1.8 },
  ],
}
