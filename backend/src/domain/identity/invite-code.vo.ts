import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'
import type { IdGenerator } from '#domain/shared/id-generator.interface'

const INVITE_CODE_PATTERN = /^[A-Z0-9]{8}$/

interface InviteCodeProps {
  value: string
}

export class InviteCode extends ValueObject<InviteCodeProps> {
  private constructor(props: InviteCodeProps) {
    super(props)
  }

  static create(raw: string): Result<InviteCode, ValidationError> {
    const normalized = raw.trim().toUpperCase()
    if (!INVITE_CODE_PATTERN.test(normalized)) {
      return Result.err({
        field: 'inviteCode',
        message: `"${raw}" n'est pas un code d'invitation valide`,
      })
    }
    return Result.ok(new InviteCode({ value: normalized }))
  }

  /**
   * Derives an 8-character code from a fresh id rather than calling
   * `Math.random()`/`crypto` directly — keeps the domain testable through
   * the same `IdGenerator` port every other id comes from. Reads from the
   * END of the id, not the start or the middle: `IdGenerator`
   * implementations are expected to produce UUIDv7-shaped ids (see
   * `UuidIdGenerator`, backed by the `uuid` package's `v7()`), and that
   * implementation is *monotonic* within a millisecond — it holds the
   * leading ~20 hex characters (timestamp + `rand_a` + the high bits of
   * `rand_b`) constant and only increments a low-order counter in the
   * trailing bits to preserve sort order. An earlier version of this
   * method sliced `[12, 20)`, which is exactly that constant region: any
   * two codes generated in the same millisecond (routine under load, and
   * in tests) came out identical and collided on the DB's unique
   * constraint. The trailing 8 hex characters are the ones that actually
   * vary on every call, same millisecond or not.
   */
  static generate(idGenerator: IdGenerator): InviteCode {
    const raw = idGenerator.next().replace(/-/g, '').toUpperCase().slice(-8).padStart(8, '0')
    return new InviteCode({ value: raw })
  }

  get value(): string {
    return this.props.value
  }
}
