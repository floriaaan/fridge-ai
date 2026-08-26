import { AggregateRoot } from '#domain/shared/aggregate-root'

interface ReceiptProps {
  householdId: string
  storeName: string
  scannedAt: Date
  totalAmount: number
  imageKey: string | null
  itemsCount: number
  createdAt: Date
}

export interface CreateReceiptProps {
  id: string
  householdId: string
  storeName: string
  scannedAt: Date
  totalAmount: number
  itemsCount: number
  imageKey?: string | null
  createdAt: Date
}

export class Receipt extends AggregateRoot<string> {
  private props: ReceiptProps

  private constructor(id: string, props: ReceiptProps) {
    super(id)
    this.props = props
  }

  static create(params: CreateReceiptProps): Receipt {
    return new Receipt(params.id, {
      householdId: params.householdId,
      storeName: params.storeName,
      scannedAt: params.scannedAt,
      totalAmount: params.totalAmount,
      itemsCount: params.itemsCount,
      imageKey: params.imageKey ?? null,
      createdAt: params.createdAt,
    })
  }

  static reconstruct(id: string, props: ReceiptProps): Receipt {
    return new Receipt(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }

  get storeName(): string {
    return this.props.storeName
  }

  get scannedAt(): Date {
    return this.props.scannedAt
  }

  get totalAmount(): number {
    return this.props.totalAmount
  }

  get imageKey(): string | null {
    return this.props.imageKey
  }

  get itemsCount(): number {
    return this.props.itemsCount
  }

  get createdAt(): Date {
    return this.props.createdAt
  }
}
