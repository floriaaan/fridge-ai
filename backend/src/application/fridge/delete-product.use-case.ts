import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface DeleteProductInput {
  householdId: string
  productId: string
}

export type DeleteProductError = 'product_not_found'

export class DeleteProduct implements UseCase<DeleteProductInput, ResultType<void, DeleteProductError>> {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: DeleteProductInput): Promise<ResultType<void, DeleteProductError>> {
    const product = await this.products.findById(input.productId)
    if (!product || product.householdId !== input.householdId) return Result.err('product_not_found')
    await this.products.delete(product.id)
    return Result.ok(undefined)
  }
}
