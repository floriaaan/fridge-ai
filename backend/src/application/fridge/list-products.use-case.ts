import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { Product } from '#domain/fridge/product.entity'
import type { LocationValue } from '#domain/fridge/location.vo'

export interface ListProductsInput {
  householdId: string
  location?: LocationValue
  expiringWithinDays?: number
}

export class ListProducts implements UseCase<ListProductsInput, Product[]> {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: ListProductsInput): Promise<Product[]> {
    return this.products.findByHousehold(input.householdId, {
      location: input.location,
      expiringWithinDays: input.expiringWithinDays,
    })
  }
}
