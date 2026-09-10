import vine from '@vinejs/vine'

export const saveHomeAssistantConnectionValidator = vine.compile(
  vine.object({
    instanceUrl: vine.string().trim(),
    // Optional, not required: the edit-in-place path (design §6) sends an
    // empty string on purpose to mean "keep the stored token", and
    // `config/bodyparser.ts`'s `convertEmptyStringsToNull` turns that `''`
    // into `null` before this validator ever sees it — a required
    // `vine.string()` rejects `null` as "must be defined" (prod: exactly
    // this, traced from the client's "validation_failed" log). `.optional()`
    // is the one Vine modifier that tolerates both `undefined` and `null`.
    token: vine.string().trim().optional(),
  }),
)

export const discoverTodoEntitiesValidator = vine.compile(
  vine.object({
    instanceUrl: vine.string().trim().optional(),
    token: vine.string().trim().optional(),
  }),
)

export const bindHomeAssistantListValidator = vine.compile(
  vine.object({
    todoEntityId: vine.string().trim().optional(),
    todoEntityName: vine.string().trim().optional(),
    direction: vine.enum(['push', 'pull', 'two_way'] as const).optional(),
    enabled: vine.boolean().optional(),
  }),
)
