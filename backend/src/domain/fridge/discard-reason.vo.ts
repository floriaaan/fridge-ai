import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export type DiscardReasonValue = 'expired' | 'spoiled' | 'disliked' | 'other'

const VALID_REASONS: readonly DiscardReasonValue[] = ['expired', 'spoiled', 'disliked', 'other']

interface DiscardReasonProps {
  value: DiscardReasonValue
}

/** Why a product was thrown away. Always optional — see the spec's decision 3. */
export class DiscardReason extends ValueObject<DiscardReasonProps> {
  private constructor(props: DiscardReasonProps) {
    super(props)
  }

  static create(raw: string): Result<DiscardReason, ValidationError> {
    if (!VALID_REASONS.includes(raw as DiscardReasonValue)) {
      return Result.err({ field: 'discardReason', message: `"${raw}" n'est pas une raison valide.` })
    }
    return Result.ok(new DiscardReason({ value: raw as DiscardReasonValue }))
  }

  get value(): DiscardReasonValue {
    return this.props.value
  }
}
