import { Entity } from '#domain/shared/entity'
import type { Product, TakeOut } from './product.entity.js'
import type { OutcomeKind } from './outcome-kind.vo.js'
import type { DiscardReason } from './discard-reason.vo.js'
import type { Quantity } from './quantity.vo.js'
import type { Location } from './location.vo.js'

export interface ProductOutcomeProps {
  householdId: string
  productId: string
  /** `null` only once the member has left the foyer — never written as null. */
  recordedBy: string | null
  recipeId: string | null
  kind: OutcomeKind
  discardReason: DiscardReason | null
  productName: string
  category: string
  categories: string[] | null
  location: Location
  quantity: Quantity
  price: number | null
  expiresAt: Date | null
  occurredAt: Date
}

export interface RecordOutcomeParams {
  id: string
  kind: OutcomeKind
  discardReason: DiscardReason | null
  recordedBy: string
  recipeId: string | null
  takeOut: TakeOut
  at: Date
}

/**
 * A product leaving the garde-manger, written down once and never edited.
 *
 * Carries its own copy of everything a statistic reads, because the product it
 * describes is usually deleted in the same transaction (ADR-0012).
 */
export class ProductOutcome extends Entity<string> {
  private readonly props: ProductOutcomeProps

  private constructor(id: string, props: ProductOutcomeProps) {
    super(id)
    this.props = props
  }

  /**
   * `product` is read for its identity and description only — never its
   * quantity, which `takeOut()` may already have decremented. The part that
   * left comes from `params.takeOut`.
   */
  static fromProduct(product: Product, params: RecordOutcomeParams): ProductOutcome {
    return new ProductOutcome(params.id, {
      householdId: product.householdId,
      productId: product.id,
      recordedBy: params.recordedBy,
      recipeId: params.recipeId,
      kind: params.kind,
      discardReason: params.discardReason,
      productName: product.name,
      category: product.category,
      categories: product.categories,
      location: product.location,
      quantity: params.takeOut.taken,
      price: params.takeOut.price,
      expiresAt: product.expiresAt,
      occurredAt: params.at,
    })
  }

  static reconstruct(id: string, props: ProductOutcomeProps): ProductOutcome {
    return new ProductOutcome(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }
  get productId(): string {
    return this.props.productId
  }
  get recordedBy(): string | null {
    return this.props.recordedBy
  }
  get recipeId(): string | null {
    return this.props.recipeId
  }
  get kind(): OutcomeKind {
    return this.props.kind
  }
  get discardReason(): DiscardReason | null {
    return this.props.discardReason
  }
  get productName(): string {
    return this.props.productName
  }
  get category(): string {
    return this.props.category
  }
  get categories(): string[] | null {
    return this.props.categories
  }
  get location(): Location {
    return this.props.location
  }
  get quantity(): Quantity {
    return this.props.quantity
  }
  get price(): number | null {
    return this.props.price
  }
  get expiresAt(): Date | null {
    return this.props.expiresAt
  }
  get occurredAt(): Date {
    return this.props.occurredAt
  }
}
