import type { HaLink } from '../../../domain/home-assistant/ha-link.js'

export const fakeUnconfiguredHaLink: HaLink = {
  configured: false,
  instanceUrl: null,
  tokenSet: false,
  todoEntityId: null,
  todoEntityName: null,
  direction: 'two_way',
  enabled: true,
  lastSyncAt: null,
  lastError: null,
}
