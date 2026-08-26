import type { ValidationError } from '#domain/shared/validation-error'

export interface SerializedError {
  status: number
  body: { error: { type: string; message: string; details?: unknown } }
}

const STRING_ERROR_STATUS: Record<string, number> = {
  invalid_credentials: 401,
}

const STRING_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe invalide.',
}

function isValidationError(error: unknown): error is ValidationError {
  return typeof error === 'object' && error !== null && 'field' in error && 'message' in error
}

/**
 * Converts a domain/application `Result.err(...)` value into an HTTP status
 * + JSON body. Household errors (Task 10) extend `STRING_ERROR_STATUS`/
 * `STRING_ERROR_MESSAGES` in place rather than duplicating this function.
 */
export function serializeError(error: unknown): SerializedError {
  if (isValidationError(error)) {
    return { status: 400, body: { error: { type: 'validation_failed', message: error.message } } }
  }

  if (typeof error === 'string') {
    return {
      status: STRING_ERROR_STATUS[error] ?? 400,
      body: { error: { type: error, message: STRING_ERROR_MESSAGES[error] ?? error } },
    }
  }

  throw new Error(`serializeError: unrecognized domain error shape: ${JSON.stringify(error)}`)
}
