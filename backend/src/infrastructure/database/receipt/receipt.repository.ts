import { DateTime } from 'luxon'
import ReceiptModel from './receipt.lucid.js'
import { toDomain } from './receipt.mapper.js'
import type { ReceiptRepository } from '#domain/receipt/interfaces/receipt-repository.interface'
import type { Receipt } from '#domain/receipt/receipt.entity'

export class LucidReceiptRepository implements ReceiptRepository {
  async findById(id: string): Promise<Receipt | null> {
    const row = await ReceiptModel.find(id)
    return row ? toDomain(row) : null
  }

  async findByHousehold(householdId: string): Promise<Receipt[]> {
    const rows = await ReceiptModel.query()
      .where('household_id', householdId)
      .orderBy('scanned_at', 'desc')
    return rows.map(toDomain)
  }

  async save(receipt: Receipt): Promise<void> {
    await ReceiptModel.updateOrCreate(
      { id: receipt.id },
      {
        householdId: receipt.householdId,
        storeName: receipt.storeName,
        scannedAt: DateTime.fromJSDate(receipt.scannedAt),
        totalAmount: receipt.totalAmount,
        imageKey: receipt.imageKey,
        itemsCount: receipt.itemsCount,
      },
    )
  }
}
