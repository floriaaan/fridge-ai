import vine from '@vinejs/vine'

export const setActiveAiProviderValidator = vine.compile(
  vine.object({ provider: vine.enum(['gemini', 'openai', 'ollama'] as const) }),
)
