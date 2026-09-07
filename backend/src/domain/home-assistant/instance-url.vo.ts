import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

interface InstanceUrlProps {
  value: string
}

export class InstanceUrl extends ValueObject<InstanceUrlProps> {
  private constructor(props: InstanceUrlProps) {
    super(props)
  }

  static create(raw: string): Result<InstanceUrl, ValidationError> {
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      return Result.err({ field: 'instanceUrl', message: "Cette adresse n'est pas valide." })
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return Result.err({ field: 'instanceUrl', message: 'Seuls http et https sont acceptés.' })
    }
    if (parsed.username || parsed.password) {
      return Result.err({
        field: 'instanceUrl',
        message: "L'adresse ne doit pas contenir d'identifiants.",
      })
    }
    if (parsed.hash) {
      return Result.err({ field: 'instanceUrl', message: "L'adresse ne doit pas contenir de fragment." })
    }

    const normalized = parsed.origin + parsed.pathname.replace(/\/+$/, '') + parsed.search
    return Result.ok(new InstanceUrl({ value: normalized }))
  }

  get value(): string {
    return this.props.value
  }
}
