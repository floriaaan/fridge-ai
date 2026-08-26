import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { Product } from '#domain/fridge/product.entity'

export interface GetExpiringSoonProductsInput {
  householdId: string
  days: number
}

export class GetExpiringSoonProducts implements UseCase<GetExpiringSoonProductsInput, Product[]> {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: GetExpiringSoonProductsInput): Promise<Product[]> {
    return this.products.findExpiringSoon(input.householdId, input.days)
  }
}
