import { Result } from '../shared/result.js'
import type { ValidationError } from '../shared/validation-error.js'

export interface QuantityValue {
  amount: number
  unit: string
}

/**
 * Client-side mirror of the backend's `Quantity` VO (`backend/src/domain/
 * fridge/quantity.vo.ts`) — same two rules, so the form can reject an
 * invalid quantity before a round trip instead of only after one.
 */
export const Quantity = {
  create(amount: number, unit: string): Result<QuantityValue, ValidationError> {
    if (!Number.isInteger(amount) || amount <= 0) {
      return Result.err({ field: 'quantity', message: 'La quantité doit être un entier supérieur à 0.' })
    }
    const trimmedUnit = unit.trim()
    if (trimmedUnit.length === 0) {
      return Result.err({ field: 'quantity', message: "L'unité est requise." })
    }
    return Result.ok({ amount, unit: trimmedUnit })
  },
}
