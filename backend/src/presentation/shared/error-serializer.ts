import type { ValidationError } from '#domain/shared/validation-error'

export interface SerializedError {
  status: number
  body: { error: { type: string; message: string; details?: unknown } }
}

const STRING_ERROR_STATUS: Record<string, number> = {
  invalid_credentials: 401,
  already_in_household: 409,
  invalid_invite_code: 404,
  no_household: 404,
  not_owner: 403,
  cannot_remove_owner: 409,
  not_a_member: 404,
  owner_cannot_leave: 409,
  provider_not_configured: 422,
}

const STRING_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe invalide.',
  already_in_household: 'Vous appartenez déjà à un foyer.',
  invalid_invite_code: "Code d'invitation invalide.",
  no_household: "Vous n'appartenez à aucun foyer.",
  not_owner: 'Seul le propriétaire du foyer peut faire cette action.',
  cannot_remove_owner: 'Le propriétaire ne peut pas être retiré.',
  not_a_member: "Cet utilisateur n'est pas membre du foyer.",
  owner_cannot_leave: 'Le propriétaire doit supprimer le foyer plutôt que le quitter.',
  provider_not_configured: 'Ce provider IA ne dispose pas des identifiants nécessaires.',
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
