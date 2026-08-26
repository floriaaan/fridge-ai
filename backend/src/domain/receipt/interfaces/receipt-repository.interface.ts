import type { Receipt } from '../receipt.entity.js'

export interface ReceiptRepository {
  findById(id: string): Promise<Receipt | null>
  findByHousehold(householdId: string): Promise<Receipt[]>
  save(receipt: Receipt): Promise<void>
}
