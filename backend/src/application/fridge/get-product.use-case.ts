import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { Product } from '#domain/fridge/product.entity'

export interface GetProductInput {
  householdId: string
  productId: string
}

export class GetProduct implements UseCase<GetProductInput, Product | null> {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: GetProductInput): Promise<Product | null> {
    const product = await this.products.findById(input.productId)
    if (!product || product.householdId !== input.householdId) return null
    return product
  }
}
