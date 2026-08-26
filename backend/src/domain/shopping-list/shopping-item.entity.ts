import { AggregateRoot } from '#domain/shared/aggregate-root'
import type { Quantity } from '#domain/fridge/quantity.vo'
import type { ShoppingItemSource } from './shopping-item-source.vo.js'

interface ShoppingItemProps {
  householdId: string
  name: string
  quantity: Quantity
  checked: boolean
  source: ShoppingItemSource
  createdAt: Date
  updatedAt: Date
}

export interface CreateShoppingItemProps {
  id: string
  householdId: string
  name: string
  quantity: Quantity
  source: ShoppingItemSource
  createdAt: Date
}

export interface UpdateShoppingItemProps {
  name?: string
  quantity?: Quantity
}

export class ShoppingItem extends AggregateRoot<string> {
  private props: ShoppingItemProps

  private constructor(id: string, props: ShoppingItemProps) {
    super(id)
    this.props = props
  }

  static create(params: CreateShoppingItemProps): ShoppingItem {
    return new ShoppingItem(params.id, {
      householdId: params.householdId,
      name: params.name,
      quantity: params.quantity,
      checked: false,
      source: params.source,
      createdAt: params.createdAt,
      updatedAt: params.createdAt,
    })
  }

  static reconstruct(id: string, props: ShoppingItemProps): ShoppingItem {
    return new ShoppingItem(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }

  get name(): string {
    return this.props.name
  }

  get quantity(): Quantity {
    return this.props.quantity
  }

  get checked(): boolean {
    return this.props.checked
  }

  get source(): ShoppingItemSource {
    return this.props.source
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  update(patch: UpdateShoppingItemProps, updatedAt: Date): void {
    this.props = { ...this.props, ...patch, updatedAt }
  }

  toggle(updatedAt: Date): void {
    this.props = { ...this.props, checked: !this.props.checked, updatedAt }
  }
}
