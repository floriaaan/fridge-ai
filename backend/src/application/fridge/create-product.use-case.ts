import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface CreateProductInput {
  householdId: string
  name: string
  quantity: { amount: number; unit: string }
  location: string
  category: string
  expiresAt?: Date | null
  openedAt?: Date | null
  openfoodfactId?: string | null
  categories?: string[] | null
  price?: number | null
}

export class CreateProduct implements UseCase<CreateProductInput, ResultType<Product, ValidationError>> {
  constructor(
    private readonly products: ProductRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateProductInput): Promise<ResultType<Product, ValidationError>> {
    const quantity = Quantity.create(input.quantity.amount, input.quantity.unit)
    if (!quantity.ok) return quantity

    const location = Location.create(input.location)
    if (!location.ok) return location

    const product = Product.create({
      id: this.idGenerator.next(),
      householdId: input.householdId,
      name: input.name,
      quantity: quantity.value,
      location: location.value,
      category: input.category,
      expiresAt: input.expiresAt ?? null,
      openedAt: input.openedAt ?? null,
      openfoodfactId: input.openfoodfactId ?? null,
      categories: input.categories ?? null,
      price: input.price ?? null,
      createdAt: this.clock.now(),
    })

    await this.products.save(product)
    return Result.ok(product)
  }
}
