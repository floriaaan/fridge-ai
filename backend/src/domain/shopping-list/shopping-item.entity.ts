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
  haUid: string | null
  haSyncedAt: Date | null
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
      haUid: null,
      haSyncedAt: null,
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

  get haUid(): string | null {
    return this.props.haUid
  }

  get haSyncedAt(): Date | null {
    return this.props.haSyncedAt
  }

  update(patch: UpdateShoppingItemProps, updatedAt: Date): void {
    this.props = { ...this.props, ...patch, updatedAt }
  }

  toggle(updatedAt: Date): void {
    this.props = { ...this.props, checked: !this.props.checked, updatedAt }
  }

  /** Refreshes the Home Assistant sync bookmark without touching local content
   * or `updatedAt` — passing `null` explicitly clears a stale uid (the item
   * was re-added to Home Assistant and does not have a new one yet). */
  markSynced(haUid: string | null, syncedAt: Date): void {
    this.props = { ...this.props, haUid, haSyncedAt: syncedAt }
  }

  /** Overwrites local content from Home Assistant's state and marks the item
   * clean at the same instant — `updatedAt` and `haSyncedAt` both become
   * `syncedAt`, so the next reconcile's dirty check (`updatedAt > haSyncedAt`)
   * reads false. */
  adoptFromHomeAssistant(
    patch: { name: string; checked: boolean; quantity: Quantity },
    haUid: string,
    syncedAt: Date,
  ): void {
    this.props = {
      ...this.props,
      name: patch.name,
      checked: patch.checked,
      quantity: patch.quantity,
      haUid,
      haSyncedAt: syncedAt,
      updatedAt: syncedAt,
    }
  }
}
