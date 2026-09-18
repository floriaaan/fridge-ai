import type { AiSettings } from '../../../domain/settings/ai-settings.js'

export const fakeAiSettings: AiSettings = {
  activeProvider: 'gemini',
  source: 'environment',
  availableProviders: ['gemini', 'openai'],
  canChooseProvider: true,
  models: { vision: 'gemini-2.5-flash', text: 'gemini-2.5-flash' },
  access: { plan: 'self-hosted', used: 0, limit: null, resetsAt: null, expiresAt: null },
}
