import type { Receipt } from '#domain/receipt/receipt.entity'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'

export interface ReceiptDraftDto {
  storeName: string
  scannedAt: string
  totalAmount: number
  items: {
    name: string
    quantity: number
    unit: string
    category: string | null
    price: number | null
  }[]
}

export interface ReceiptDto {
  id: string
  storeName: string
  scannedAt: string
  totalAmount: number
  imageKey: string | null
  itemsCount: number
  createdAt: string
}

export function toReceiptDraftDto(draft: ReceiptDraft): ReceiptDraftDto {
  return {
    storeName: draft.storeName,
    scannedAt: draft.scannedAt.toISOString(),
    totalAmount: draft.totalAmount,
    items: draft.items,
  }
}

export function toReceiptDto(receipt: Receipt): ReceiptDto {
  return {
    id: receipt.id,
    storeName: receipt.storeName,
    scannedAt: receipt.scannedAt.toISOString(),
    totalAmount: receipt.totalAmount,
    imageKey: receipt.imageKey,
    itemsCount: receipt.itemsCount,
    createdAt: receipt.createdAt.toISOString(),
  }
}
