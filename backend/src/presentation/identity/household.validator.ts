import vine from '@vinejs/vine'

export const createHouseholdValidator = vine.compile(
  vine.object({ name: vine.string().trim().minLength(1).maxLength(80) }),
)

export const joinHouseholdValidator = vine.compile(
  vine.object({ inviteCode: vine.string().trim().minLength(8).maxLength(8) }),
)
