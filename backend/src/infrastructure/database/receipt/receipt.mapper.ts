import { Receipt } from '#domain/receipt/receipt.entity'
import type ReceiptModel from './receipt.lucid.js'

export function toDomain(row: ReceiptModel): Receipt {
  return Receipt.reconstruct(row.id, {
    householdId: row.householdId,
    storeName: row.storeName,
    scannedAt: row.scannedAt.toJSDate(),
    totalAmount: row.totalAmount,
    imageKey: row.imageKey,
    itemsCount: row.itemsCount,
    createdAt: row.createdAt.toJSDate(),
  })
}
