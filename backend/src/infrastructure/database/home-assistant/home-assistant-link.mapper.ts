import { DateTime } from 'luxon'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { SyncDirection } from '#domain/home-assistant/sync-direction.vo'
import { LinkUnreadableError } from '#domain/home-assistant/link-unreadable.error'
import type { Encryption } from '#domain/shared/encryption.interface'
import type HomeAssistantLinkModel from './home-assistant-link.lucid.js'

export function toDomain(row: HomeAssistantLinkModel, encryption: Encryption): HomeAssistantLink {
  const instanceUrl = InstanceUrl.create(row.instanceUrl)
  if (!instanceUrl.ok) {
    throw new Error(`Corrupted home_assistant_link row ${row.id}: ${instanceUrl.error.message}`)
  }

  const direction = SyncDirection.create(row.direction)
  if (!direction.ok) {
    throw new Error(`Corrupted home_assistant_link row ${row.id}: ${direction.error.message}`)
  }

  let token: string
  try {
    token = encryption.decrypt(row.encryptedToken)
  } catch {
    throw new LinkUnreadableError(row.id)
  }

  return HomeAssistantLink.reconstruct(row.id, {
    householdId: row.householdId,
    instanceUrl: instanceUrl.value,
    token,
    todoEntityId: row.todoEntityId,
    todoEntityName: row.todoEntityName,
    direction: direction.value,
    enabled: row.enabled,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toJSDate() : null,
    lastError: row.lastError,
    createdAt: row.createdAt.toJSDate(),
    updatedAt: row.updatedAt.toJSDate(),
  })
}

export function toPersistence(link: HomeAssistantLink, encryption: Encryption) {
  return {
    id: link.id,
    householdId: link.householdId,
    instanceUrl: link.instanceUrl.value,
    encryptedToken: encryption.encrypt(link.token),
    todoEntityId: link.todoEntityId,
    todoEntityName: link.todoEntityName,
    direction: link.direction.value,
    enabled: link.enabled,
    lastSyncAt: link.lastSyncAt ? DateTime.fromJSDate(link.lastSyncAt) : null,
    lastError: link.lastError,
  }
}
