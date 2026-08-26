import type { UseCase } from '#application/shared/use-case'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface CreateShoppingItemInput {
  householdId: string
  name: string
  quantity: { amount: number; unit: string }
  source: string
}

export class CreateShoppingItem implements UseCase<
  CreateShoppingItemInput,
  ResultType<ShoppingItem, ValidationError>
> {
  constructor(
    private readonly items: ShoppingItemRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: CreateShoppingItemInput,
  ): Promise<ResultType<ShoppingItem, ValidationError>> {
    const quantity = Quantity.create(input.quantity.amount, input.quantity.unit)
    if (!quantity.ok) return quantity

    const source = ShoppingItemSource.create(input.source)
    if (!source.ok) return source

    const item = ShoppingItem.create({
      id: this.idGenerator.next(),
      householdId: input.householdId,
      name: input.name,
      quantity: quantity.value,
      source: source.value,
      createdAt: this.clock.now(),
    })

    await this.items.save(item)
    return Result.ok(item)
  }
}
