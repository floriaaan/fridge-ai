import vine from '@vinejs/vine'

export const saveHomeAssistantConnectionValidator = vine.compile(
  vine.object({
    instanceUrl: vine.string().trim(),
    token: vine.string().trim(),
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
