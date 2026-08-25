import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface EmailProps {
  value: string
}

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props)
  }

  static create(raw: string): Result<Email, ValidationError> {
    const normalized = raw.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(normalized)) {
      return Result.err({ field: 'email', message: `"${raw}" n'est pas une adresse email valide` })
    }
    return Result.ok(new Email({ value: normalized }))
  }

  get value(): string {
    return this.props.value
  }

  toString(): string {
    return this.props.value
  }
}
