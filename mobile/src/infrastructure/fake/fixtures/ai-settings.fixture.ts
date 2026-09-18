import type { AiSettings } from '../../../domain/settings/ai-settings.js'

export const fakeAiSettings: AiSettings = {
  activeProvider: 'gemini',
  source: 'environment',
  availableProviders: ['gemini', 'openai'],
  lockedProviders: [],
  models: { vision: 'gemini-2.5-flash', text: 'gemini-2.5-flash' },
}
