import type { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'

export interface HomeAssistantLinkDto {
  configured: boolean
  instanceUrl: string | null
  tokenSet: boolean
  todoEntityId: string | null
  todoEntityName: string | null
  direction: 'push' | 'pull' | 'two_way'
  enabled: boolean
  lastSyncAt: string | null
  lastError: string | null
}

export function toHomeAssistantLinkDto(link: HomeAssistantLink | null): HomeAssistantLinkDto {
  if (!link) {
    return {
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
  }
  return {
    configured: true,
    instanceUrl: link.instanceUrl.value,
    tokenSet: true,
    todoEntityId: link.todoEntityId,
    todoEntityName: link.todoEntityName,
    direction: link.direction.value,
    enabled: link.enabled,
    lastSyncAt: link.lastSyncAt ? link.lastSyncAt.toISOString() : null,
    lastError: link.lastError,
  }
}
