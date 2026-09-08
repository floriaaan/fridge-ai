import type { UseCase } from '#application/shared/use-case'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { HomeAssistantClient, HomeAssistantConnection } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import type { TodoItem } from '#domain/home-assistant/todo-item'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface SyncShoppingListInput {
  householdId: string
}

export interface SyncShoppingListSummary {
  synced: boolean
}

/**
 * The reconcile (design §4). Home Assistant's `todo` items carry no
 * timestamp, so "dirty" is `item.haSyncedAt === null || item.updatedAt >
 * item.haSyncedAt` — never a comparison against anything on the HA side.
 *
 * Four passes, in order, because each depends on the previous one's result:
 * 1. items whose uid is already known — the ordinary push/pull/two_way rules
 * 2. adopt a uid by matching name, for local items that don't have one yet
 * 3. local items still without a uid after (2): push a brand-new HA item
 * 4. HA items nobody local claimed: import, unless direction is `push`
 */
export class SyncShoppingList
  implements UseCase<SyncShoppingListInput, ResultType<SyncShoppingListSummary, string>>
{
  constructor(
    private readonly links: HomeAssistantLinkRepository,
    private readonly items: ShoppingItemRepository,
    private readonly client: HomeAssistantClient,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: SyncShoppingListInput): Promise<ResultType<SyncShoppingListSummary, string>> {
    const link = await this.links.find(input.householdId)
    if (!link || !link.enabled || !link.todoEntityId) {
      return Result.ok({ synced: false })
    }

    const entityId = link.todoEntityId
    const connection: HomeAssistantConnection = { instanceUrl: link.instanceUrl.value, token: link.token }
    const now = this.clock.now()

    const haItemsResult = await this.client.listItems(connection, entityId)
    if (!haItemsResult.ok) {
      link.recordFailure(haItemsResult.error, now)
      await this.links.save(link)
      return Result.err(haItemsResult.error)
    }

    const haById = new Map(haItemsResult.value.map((item) => [item.uid, item]))
    const claimed = new Set<string>()
    const localItems = await this.items.findByHousehold(input.householdId)

    try {
      await this.reconcileKnownUids(connection, entityId, link.direction.value, localItems, haById, claimed, now)
      await this.adoptUidsByName(haItemsResult.value, localItems, claimed, now)

      if (link.direction.value !== 'pull') {
        for (const item of localItems) {
          if (item.haUid) continue // already known, or just adopted above
          await this.push(connection, entityId, item)
        }
      }

      if (link.direction.value !== 'push') {
        for (const haItem of haItemsResult.value) {
          if (claimed.has(haItem.uid)) continue
          await this.importFromHomeAssistant(input.householdId, haItem, now)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      link.recordFailure(message, now)
      await this.links.save(link)
      return Result.err(message)
    }

    link.recordSync(now)
    await this.links.save(link)
    return Result.ok({ synced: true })
  }

  private async reconcileKnownUids(
    connection: HomeAssistantConnection,
    entityId: string,
    direction: 'push' | 'pull' | 'two_way',
    localItems: ShoppingItem[],
    haById: Map<string, TodoItem>,
    claimed: Set<string>,
    now: Date,
  ): Promise<void> {
    for (const item of localItems) {
      const uid = item.haUid
      if (!uid) continue
      const haItem = haById.get(uid)

      if (!haItem) {
        if (direction === 'push') {
          // uid is dead — calling push() here would call update_item against
          // it and fail. Just clear it; pass 2 may re-adopt it by name, and
          // pass 3 re-adds it to HA if not.
          item.markSynced(null, now)
          await this.items.save(item)
        } else {
          await this.items.delete(item.id)
        }
        continue
      }

      claimed.add(uid)
      const dirty = item.haSyncedAt === null || item.updatedAt > item.haSyncedAt

      if (direction === 'push' || (direction === 'two_way' && dirty)) {
        await this.push(connection, entityId, item)
        item.markSynced(uid, now)
        await this.items.save(item)
      } else {
        this.adopt(item, haItem, now)
        await this.items.save(item)
      }
    }
  }

  private async adoptUidsByName(
    haItems: TodoItem[],
    localItems: ShoppingItem[],
    claimed: Set<string>,
    now: Date,
  ): Promise<void> {
    const unclaimedHaItems = haItems.filter((h) => !claimed.has(h.uid))
    for (const item of localItems) {
      if (item.haUid) continue
      const match = unclaimedHaItems.find(
        (h) => !claimed.has(h.uid) && normalizeName(h.summary) === normalizeName(item.name),
      )
      if (!match) continue
      claimed.add(match.uid)
      item.markSynced(match.uid, now)
      await this.items.save(item)
    }
  }

  private async importFromHomeAssistant(householdId: string, haItem: TodoItem, now: Date): Promise<void> {
    const sourceResult = ShoppingItemSource.create('manual')
    if (!sourceResult.ok) throw new Error('unreachable: "manual" is always a valid shopping item source')

    const created = ShoppingItem.create({
      id: this.idGenerator.next(),
      householdId,
      name: haItem.summary,
      quantity: parseQuantity(haItem.description),
      source: sourceResult.value,
      createdAt: now,
    })
    if (haItem.status === 'completed') created.toggle(now)
    created.markSynced(haItem.uid, now)
    await this.items.save(created)
  }

  private async push(connection: HomeAssistantConnection, entityId: string, item: ShoppingItem): Promise<void> {
    const patch = {
      summary: item.name,
      description: formatQuantity(item.quantity),
      status: item.checked ? ('completed' as const) : ('needs_action' as const),
    }
    if (item.haUid) {
      const result = await this.client.updateItem(connection, entityId, item.haUid, patch)
      if (!result.ok) throw new Error(result.error)
    } else {
      const result = await this.client.addItem(connection, entityId, {
        summary: patch.summary,
        description: patch.description,
      })
      if (!result.ok) throw new Error(result.error)
    }
  }

  private adopt(item: ShoppingItem, haItem: TodoItem, now: Date): void {
    item.adoptFromHomeAssistant(
      { name: haItem.summary, checked: haItem.status === 'completed', quantity: parseQuantity(haItem.description) },
      haItem.uid,
      now,
    )
  }
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function formatQuantity(quantity: Quantity): string {
  return `${quantity.amount} ${quantity.unit}`
}

/** `description` is Home Assistant's free-text field — best-effort parse of
 * "<amount> <unit>"; anything else (or no description at all) falls back to
 * a default quantity rather than failing the import (design §4). */
function parseQuantity(description: string | null): Quantity {
  const match = description?.trim().match(/^(\d+)\s+(.+)$/)
  const amount = match?.[1]
  const unit = match?.[2]
  if (amount !== undefined && unit !== undefined) {
    const parsed = Quantity.create(Number(amount), unit)
    if (parsed.ok) return parsed.value
  }
  const fallback = Quantity.create(1, 'pièce')
  if (!fallback.ok) throw new Error('unreachable: default quantity is always valid')
  return fallback.value
}
