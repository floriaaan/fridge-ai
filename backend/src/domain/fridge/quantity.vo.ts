import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

interface QuantityProps {
  amount: number
  unit: string
}

/**
 * `amount` must be a positive integer, not just positive — the `product`
 * table's `quantity` column is INTEGER (docs/phase-0/03-schema-base-de-donnees.md),
 * so a fractional amount would fail at the DB layer with a far less useful
 * error than this validation gives up front.
 */
export class Quantity extends ValueObject<QuantityProps> {
  private constructor(props: QuantityProps) {
    super(props)
  }

  static create(amount: number, unit: string): Result<Quantity, ValidationError> {
    if (!Number.isInteger(amount) || amount <= 0) {
      return Result.err({
        field: 'quantity',
        message: 'La quantité doit être un entier supérieur à 0.',
      })
    }
    const trimmedUnit = unit.trim()
    if (trimmedUnit.length === 0) {
      return Result.err({ field: 'quantity', message: "L'unité est requise." })
    }
    return Result.ok(new Quantity({ amount, unit: trimmedUnit }))
  }

  get amount(): number {
    return this.props.amount
  }

  get unit(): string {
    return this.props.unit
  }
}
