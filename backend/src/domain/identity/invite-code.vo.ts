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
   * the same `IdGenerator` port every other id comes from.
   */
  static generate(idGenerator: IdGenerator): InviteCode {
    const raw = idGenerator
      .next()
      .replace(/-/g, '')
      .toUpperCase()
      .slice(0, 8)
      .padEnd(8, '0')
    return new InviteCode({ value: raw })
  }

  get value(): string {
    return this.props.value
  }
}
