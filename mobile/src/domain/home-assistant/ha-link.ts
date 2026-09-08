export type HaSyncDirection = 'push' | 'pull' | 'two_way'

/** Mirrors `HomeAssistantLinkDto` (backend) field-for-field. */
export interface HaLink {
  configured: boolean
  instanceUrl: string | null
  tokenSet: boolean
  todoEntityId: string | null
  todoEntityName: string | null
  direction: HaSyncDirection
  enabled: boolean
  lastSyncAt: string | null
  lastError: string | null
}

export interface HaTodoEntity {
  entityId: string
  friendlyName: string
}

export interface SaveHaConnectionInput {
  instanceUrl: string
  token: string
}

export interface DiscoverHaEntitiesInput {
  instanceUrl?: string
  token?: string
}

export interface BindHaListInput {
  todoEntityId?: string
  todoEntityName?: string
  direction?: HaSyncDirection
  enabled?: boolean
}
