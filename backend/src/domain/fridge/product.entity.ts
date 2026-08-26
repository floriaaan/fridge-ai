import { AggregateRoot } from '#domain/shared/aggregate-root'
import type { Quantity } from './quantity.vo.js'
import type { Location } from './location.vo.js'

interface ProductProps {
  householdId: string
  receiptId: string | null
  name: string
  quantity: Quantity
  location: Location
  expiresAt: Date | null
  openedAt: Date | null
  category: string
  openfoodfactId: string | null
  categories: string[] | null
  price: number | null
  imageKey: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateProductProps {
  id: string
  householdId: string
  name: string
  quantity: Quantity
  location: Location
  category: string
  expiresAt?: Date | null
  openedAt?: Date | null
  openfoodfactId?: string | null
  categories?: string[] | null
  receiptId?: string | null
  price?: number | null
  imageKey?: string | null
  createdAt: Date
}

export interface UpdateProductProps {
  name?: string
  quantity?: Quantity
  location?: Location
  category?: string
  expiresAt?: Date | null
  openedAt?: Date | null
  openfoodfactId?: string | null
  categories?: string[] | null
  price?: number | null
  imageKey?: string | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * `updatedAt` is carried for DTO purposes only — `update()` stamps it from a
 * caller-supplied `Date` (the use-case passes `Clock.now()`) so the response
 * of the same request that triggered the update reflects it immediately;
 * the DB row's real value (Lucid's `autoUpdate`, cf. product.lucid.ts,
 * Task 5) is the source of truth on every subsequent read.
 */
export class Product extends AggregateRoot<string> {
  private props: ProductProps

  private constructor(id: string, props: ProductProps) {
    super(id)
    this.props = props
  }

  static create(params: CreateProductProps): Product {
    return new Product(params.id, {
      householdId: params.householdId,
      receiptId: params.receiptId ?? null,
      name: params.name,
      quantity: params.quantity,
      location: params.location,
      expiresAt: params.expiresAt ?? null,
      openedAt: params.openedAt ?? null,
      category: params.category,
      openfoodfactId: params.openfoodfactId ?? null,
      categories: params.categories ?? null,
      price: params.price ?? null,
      imageKey: params.imageKey ?? null,
      createdAt: params.createdAt,
      updatedAt: params.createdAt,
    })
  }

  static reconstruct(id: string, props: ProductProps): Product {
    return new Product(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }

  get receiptId(): string | null {
    return this.props.receiptId
  }

  get name(): string {
    return this.props.name
  }

  get quantity(): Quantity {
    return this.props.quantity
  }

  get location(): Location {
    return this.props.location
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt
  }

  get openedAt(): Date | null {
    return this.props.openedAt
  }

  get category(): string {
    return this.props.category
  }

  get openfoodfactId(): string | null {
    return this.props.openfoodfactId
  }

  get categories(): string[] | null {
    return this.props.categories
  }

  get price(): number | null {
    return this.props.price
  }

  get imageKey(): string | null {
    return this.props.imageKey
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  /**
   * `patch` must only include keys the caller actually wants to change —
   * never pass `undefined` for "leave as is", omit the key instead (object
   * spread does not treat an explicit `undefined` as "absent").
   */
  update(patch: UpdateProductProps, updatedAt: Date): void {
    this.props = { ...this.props, ...patch, updatedAt }
  }

  isExpiringSoon(withinDays: number, now: Date): boolean {
    if (!this.props.expiresAt) return false
    const threshold = new Date(now.getTime() + withinDays * MS_PER_DAY)
    return this.props.expiresAt >= now && this.props.expiresAt <= threshold
  }

  isExpired(now: Date): boolean {
    return this.props.expiresAt !== null && this.props.expiresAt < now
  }
}
