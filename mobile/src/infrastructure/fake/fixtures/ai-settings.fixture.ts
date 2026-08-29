import type { AiSettings } from '../../../domain/settings/ai-settings.js'

export const fakeAiSettings: AiSettings = {
  activeProvider: 'gemini',
  source: 'environment',
  availableProviders: ['gemini', 'openai'],
}
