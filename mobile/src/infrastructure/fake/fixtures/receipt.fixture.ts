import type { Receipt } from '../../../domain/receipt/receipt.js'

export const fakeReceipts: Receipt[] = [
  {
    id: 'fake-receipt-1',
    storeName: 'Carrefour',
    scannedAt: '2026-08-20T10:00:00.000Z',
    totalAmount: 24.5,
    imageKey: null,
    itemsCount: 2,
    createdAt: '2026-08-20T10:05:00.000Z',
  },
]
