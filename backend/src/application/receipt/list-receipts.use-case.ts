import type { UseCase } from '#application/shared/use-case'
import type { ReceiptRepository } from '#domain/receipt/interfaces/receipt-repository.interface'
import type { Receipt } from '#domain/receipt/receipt.entity'

export interface ListReceiptsInput {
  householdId: string
}

export class ListReceipts implements UseCase<ListReceiptsInput, Receipt[]> {
  constructor(private readonly receipts: ReceiptRepository) {}

  async execute(input: ListReceiptsInput): Promise<Receipt[]> {
    return this.receipts.findByHousehold(input.householdId)
  }
}
