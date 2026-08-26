import type { UseCase } from '#application/shared/use-case'
import type { ReceiptRepository } from '#domain/receipt/interfaces/receipt-repository.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { Receipt } from '#domain/receipt/receipt.entity'
import type { Product } from '#domain/fridge/product.entity'

export interface GetReceiptInput {
  householdId: string
  receiptId: string
}

export interface GetReceiptOutput {
  receipt: Receipt
  products: Product[]
}

export class GetReceipt implements UseCase<GetReceiptInput, GetReceiptOutput | null> {
  constructor(
    private readonly receipts: ReceiptRepository,
    private readonly products: ProductRepository,
  ) {}

  async execute(input: GetReceiptInput): Promise<GetReceiptOutput | null> {
    const receipt = await this.receipts.findById(input.receiptId)
    if (!receipt || receipt.householdId !== input.householdId) return null

    const products = await this.products.findByReceiptId(receipt.id)
    return { receipt, products }
  }
}
