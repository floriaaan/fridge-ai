import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export type LocationValue = 'fridge' | 'freezer' | 'pantry'

const VALID_LOCATIONS: readonly LocationValue[] = ['fridge', 'freezer', 'pantry']

interface LocationProps {
  value: LocationValue
}

export class Location extends ValueObject<LocationProps> {
  private constructor(props: LocationProps) {
    super(props)
  }

  static create(raw: string): Result<Location, ValidationError> {
    if (!VALID_LOCATIONS.includes(raw as LocationValue)) {
      return Result.err({ field: 'location', message: `"${raw}" n'est pas un emplacement valide.` })
    }
    return Result.ok(new Location({ value: raw as LocationValue }))
  }

  get value(): LocationValue {
    return this.props.value
  }
}
