import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export type OutcomeKindValue = 'consumed' | 'discarded'

const VALID_KINDS: readonly OutcomeKindValue[] = ['consumed', 'discarded']

interface OutcomeKindProps {
  value: OutcomeKindValue
}

/**
 * How a product left the garde-manger. A data-entry correction is deliberately
 * not a kind: it is a plain DELETE and writes no outcome (ADR-0012).
 */
export class OutcomeKind extends ValueObject<OutcomeKindProps> {
  private constructor(props: OutcomeKindProps) {
    super(props)
  }

  static create(raw: string): Result<OutcomeKind, ValidationError> {
    if (!VALID_KINDS.includes(raw as OutcomeKindValue)) {
      return Result.err({ field: 'kind', message: `"${raw}" n'est pas une sortie valide.` })
    }
    return Result.ok(new OutcomeKind({ value: raw as OutcomeKindValue }))
  }

  static consumed(): OutcomeKind {
    return new OutcomeKind({ value: 'consumed' })
  }

  static discarded(): OutcomeKind {
    return new OutcomeKind({ value: 'discarded' })
  }

  get value(): OutcomeKindValue {
    return this.props.value
  }
}
