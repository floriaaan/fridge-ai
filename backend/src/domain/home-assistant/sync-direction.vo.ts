import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export type SyncDirectionValue = 'push' | 'pull' | 'two_way'

const VALID_DIRECTIONS: readonly SyncDirectionValue[] = ['push', 'pull', 'two_way']

interface SyncDirectionProps {
  value: SyncDirectionValue
}

export class SyncDirection extends ValueObject<SyncDirectionProps> {
  private constructor(props: SyncDirectionProps) {
    super(props)
  }

  static create(raw: string): Result<SyncDirection, ValidationError> {
    if (!VALID_DIRECTIONS.includes(raw as SyncDirectionValue)) {
      return Result.err({
        field: 'direction',
        message: `"${raw}" n'est pas un sens de synchronisation valide.`,
      })
    }
    return Result.ok(new SyncDirection({ value: raw as SyncDirectionValue }))
  }

  /** The default for a newly-created link (design §1) — always valid, so no `Result`. */
  static twoWay(): SyncDirection {
    return new SyncDirection({ value: 'two_way' })
  }

  get value(): SyncDirectionValue {
    return this.props.value
  }
}
