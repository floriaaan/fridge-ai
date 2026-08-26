import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export type RecipeSourceValue = 'ai' | 'user'

const VALID_SOURCES: readonly RecipeSourceValue[] = ['ai', 'user']

interface RecipeSourceProps {
  value: RecipeSourceValue
}

/**
 * A VO (not a plain string-union type like `HouseholdRole`/`AiProvider`)
 * because `source` is client-supplied on `POST /api/recipes` (saving a
 * manual recipe) and needs the same runtime validation as `Location`.
 */
export class RecipeSource extends ValueObject<RecipeSourceProps> {
  private constructor(props: RecipeSourceProps) {
    super(props)
  }

  static create(raw: string): Result<RecipeSource, ValidationError> {
    if (!VALID_SOURCES.includes(raw as RecipeSourceValue)) {
      return Result.err({ field: 'source', message: `"${raw}" n'est pas une source valide.` })
    }
    return Result.ok(new RecipeSource({ value: raw as RecipeSourceValue }))
  }

  get value(): RecipeSourceValue {
    return this.props.value
  }
}
