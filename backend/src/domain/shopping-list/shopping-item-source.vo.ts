import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export type ShoppingItemSourceValue = 'manual' | 'auto_expired' | 'recipe'

const VALID_SOURCES: readonly ShoppingItemSourceValue[] = ['manual', 'auto_expired', 'recipe']

interface ShoppingItemSourceProps {
  value: ShoppingItemSourceValue
}

/**
 * v1 never *produces* `auto_expired`/`recipe` items automatically — no job
 * watches expiry, no endpoint bulk-adds missing recipe ingredients (design
 * spec §4, ADR-0010's YAGNI stance). The enum still validates all three
 * values so the schema doesn't lie about what's storable, and nothing
 * blocks wiring an automatic producer later.
 */
export class ShoppingItemSource extends ValueObject<ShoppingItemSourceProps> {
  private constructor(props: ShoppingItemSourceProps) {
    super(props)
  }

  static create(raw: string): Result<ShoppingItemSource, ValidationError> {
    if (!VALID_SOURCES.includes(raw as ShoppingItemSourceValue)) {
      return Result.err({ field: 'source', message: `"${raw}" n'est pas une source valide.` })
    }
    return Result.ok(new ShoppingItemSource({ value: raw as ShoppingItemSourceValue }))
  }

  get value(): ShoppingItemSourceValue {
    return this.props.value
  }
}
