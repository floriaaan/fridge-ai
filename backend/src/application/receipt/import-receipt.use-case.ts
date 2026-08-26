import type { UseCase } from '#application/shared/use-case'
import type { ReceiptRepository } from '#domain/receipt/interfaces/receipt-repository.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Receipt } from '#domain/receipt/receipt.entity'
import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export interface ImportReceiptItemInput {
  name: string
  quantity: number
  unit: string
  category: string | null
  price: number | null
  location: string
  expiresAt: Date | null
}

export interface ImportReceiptInput {
  householdId: string
  storeName: string
  scannedAt: Date
  totalAmount: number
  imageKey: string | null
  items: ImportReceiptItemInput[]
}

export interface ImportReceiptOutput {
  receipt: Receipt
  products: Product[]
}

/**
 * Saves the receipt, then each product — sequential, not one DB transaction
 * spanning both aggregates (`ReceiptRepository`/`ProductRepository` don't
 * expose a shared unit-of-work, matching the ports as specified in
 * docs/phase-0/02-modele-de-domaine.md). A crash between the receipt save
 * and the last product save leaves a receipt with fewer products than
 * `itemsCount` claims — recoverable by re-import, not auto-healed. Flagged
 * here rather than solved: acceptable for a single-instance self-hosted app,
 * revisit if this ever needs to be bulletproof.
 */
export class ImportReceipt
  implements UseCase<ImportReceiptInput, ResultType<ImportReceiptOutput, ValidationError>>
{
  constructor(
    private readonly receipts: ReceiptRepository,
    private readonly products: ProductRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: ImportReceiptInput): Promise<ResultType<ImportReceiptOutput, ValidationError>> {
    const now = this.clock.now()
    const receipt = Receipt.create({
      id: this.idGenerator.next(),
      householdId: input.householdId,
      storeName: input.storeName,
      scannedAt: input.scannedAt,
      totalAmount: input.totalAmount,
      itemsCount: input.items.length,
      imageKey: input.imageKey,
      createdAt: now,
    })

    const products: Product[] = []
    for (const item of input.items) {
      const quantity = Quantity.create(item.quantity, item.unit)
      if (!quantity.ok) return quantity

      const location = Location.create(item.location)
      if (!location.ok) return location

      products.push(
        Product.create({
          id: this.idGenerator.next(),
          householdId: input.householdId,
          receiptId: receipt.id,
          name: item.name,
          quantity: quantity.value,
          location: location.value,
          category: item.category ?? 'Non catégorisé',
          expiresAt: item.expiresAt,
          price: item.price,
          createdAt: now,
        }),
      )
    }

    await this.receipts.save(receipt)
    for (const product of products) {
      await this.products.save(product)
    }

    return Result.ok({ receipt, products })
  }
}
