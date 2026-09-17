import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export interface ImportProductsItemInput {
  name: string
  quantity: number
  unit: string
  category: string | null
  location: string
  expiresAt: Date | null
}

export interface ImportProductsInput {
  householdId: string
  items: ImportProductsItemInput[]
}

export interface ImportProductsOutput {
  products: Product[]
}

/**
 * The fridge-scan counterpart of `ImportReceipt` — no receipt aggregate,
 * `receiptId`/`price` are always null (a photo of the fridge names no
 * ticket and no price).
 */
export class ImportProducts implements UseCase<
  ImportProductsInput,
  ResultType<ImportProductsOutput, ValidationError>
> {
  constructor(
    private readonly products: ProductRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: ImportProductsInput,
  ): Promise<ResultType<ImportProductsOutput, ValidationError>> {
    const now = this.clock.now()

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
          receiptId: null,
          name: item.name,
          quantity: quantity.value,
          location: location.value,
          category: item.category ?? 'Non catégorisé',
          expiresAt: item.expiresAt,
          price: null,
          createdAt: now,
        }),
      )
    }

    for (const product of products) {
      await this.products.save(product)
    }

    return Result.ok({ products })
  }
}
