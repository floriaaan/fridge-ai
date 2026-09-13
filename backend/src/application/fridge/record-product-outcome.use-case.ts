import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import type { Product } from '#domain/fridge/product.entity'
import { ProductOutcome } from '#domain/fridge/product-outcome.entity'
import { OutcomeKind } from '#domain/fridge/outcome-kind.vo'
import { DiscardReason } from '#domain/fridge/discard-reason.vo'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface RecordProductOutcomeInput {
  householdId: string
  userId: string
  productId: string
  kind: string
  /** Defaults to the whole remaining stock. */
  amount?: number
  discardReason?: string | null
}

export type RecordProductOutcomeError = 'product_not_found' | ValidationError

export interface RecordedProductOutcome {
  /** `null` when the whole stock left the garde-manger. */
  product: Product | null
  outcome: ProductOutcome
}

/**
 * A product, or part of it, leaves the garde-manger — eaten or thrown away.
 *
 * Every check runs before `takeOut()`, the only step that mutates the product,
 * so a refused request leaves it exactly as it was.
 */
export class RecordProductOutcome implements UseCase<
  RecordProductOutcomeInput,
  ResultType<RecordedProductOutcome, RecordProductOutcomeError>
> {
  constructor(
    private readonly products: ProductRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: RecordProductOutcomeInput,
  ): Promise<ResultType<RecordedProductOutcome, RecordProductOutcomeError>> {
    const product = await this.products.findById(input.productId)
    if (!product || product.householdId !== input.householdId)
      return Result.err('product_not_found')

    const kind = OutcomeKind.create(input.kind)
    if (!kind.ok) return kind

    let discardReason: DiscardReason | null = null
    if (input.discardReason !== undefined && input.discardReason !== null) {
      if (kind.value.value !== 'discarded') {
        return Result.err({
          field: 'discardReason',
          message: 'Une raison ne s’applique qu’à un produit jeté.',
        })
      }
      const reason = DiscardReason.create(input.discardReason)
      if (!reason.ok) return reason
      discardReason = reason.value
    }

    const at = this.clock.now()
    const takeOut = product.takeOut(input.amount ?? product.quantity.amount, at)
    if (!takeOut.ok) return takeOut

    const outcome = ProductOutcome.fromProduct(product, {
      id: this.idGenerator.next(),
      kind: kind.value,
      discardReason,
      recordedBy: input.userId,
      recipeId: null,
      takeOut: takeOut.value,
      at,
    })

    await this.products.recordOutcome(outcome, takeOut.value.remaining)
    return Result.ok({ product: takeOut.value.remaining, outcome })
  }
}
