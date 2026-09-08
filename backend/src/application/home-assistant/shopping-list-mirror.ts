import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantClient, HomeAssistantConnection } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import type { Clock } from '#domain/shared/clock.interface'

const MIRROR_TIMEOUT_MS = 2000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('mirror timeout')), ms)),
  ])
}

/**
 * Write-through to Home Assistant (design §5). Deliberately not a `UseCase`
 * (see Global Constraints): no single `execute`, nothing for a caller to
 * act on, and it swallows its own errors — the shopping-item write it rides
 * on has already succeeded by the time this runs.
 */
export class ShoppingListMirror {
  constructor(
    private readonly links: HomeAssistantLinkRepository,
    private readonly client: HomeAssistantClient,
    private readonly hostPolicy: HostPolicy,
    private readonly clock: Clock,
  ) {}

  async itemCreated(item: ShoppingItem): Promise<void> {
    await this.run(item.householdId, async (connection, entityId) => {
      const result = await withTimeout(
        this.client.addItem(connection, entityId, {
          summary: item.name,
          description: `${item.quantity.amount} ${item.quantity.unit}`,
        }),
        MIRROR_TIMEOUT_MS,
      )
      if (!result.ok) throw new Error(result.error)
    })
  }

  async itemUpdated(item: ShoppingItem): Promise<void> {
    if (!item.haUid) return // not yet adopted — the next reconcile will pick up the uid and the content both
    const haUid = item.haUid
    await this.run(item.householdId, async (connection, entityId) => {
      const result = await withTimeout(
        this.client.updateItem(connection, entityId, haUid, {
          summary: item.name,
          description: `${item.quantity.amount} ${item.quantity.unit}`,
          status: item.checked ? 'completed' : 'needs_action',
        }),
        MIRROR_TIMEOUT_MS,
      )
      if (!result.ok) throw new Error(result.error)
    })
  }

  async itemDeleted(householdId: string, haUid: string | null): Promise<void> {
    if (!haUid) return
    await this.run(householdId, async (connection, entityId) => {
      const result = await withTimeout(this.client.removeItem(connection, entityId, haUid), MIRROR_TIMEOUT_MS)
      if (!result.ok) throw new Error(result.error)
    })
  }

  private async run(
    householdId: string,
    call: (connection: HomeAssistantConnection, entityId: string) => Promise<void>,
  ): Promise<void> {
    const now = this.clock.now()
    let link
    try {
      link = await this.links.find(householdId)
    } catch {
      return // link_unreadable — nothing sane to mirror to, stay silent
    }
    if (!link || !link.enabled || !link.todoEntityId || link.direction.value === 'pull') return
    if (!this.hostPolicy.isAllowed(link.instanceUrl)) return

    try {
      await call({ instanceUrl: link.instanceUrl.value, token: link.token }, link.todoEntityId)
      link.recordSync(now)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      link.recordFailure(message, now)
    }
    await this.links.save(link)
  }
}
