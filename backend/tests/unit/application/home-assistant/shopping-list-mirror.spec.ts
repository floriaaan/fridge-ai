import { test } from '@japa/runner'
import { ShoppingListMirror } from '#application/home-assistant/shopping-list-mirror'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { SyncDirection } from '#domain/home-assistant/sync-direction.vo'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import { FakeHomeAssistantLinkRepository, RecordingHomeAssistantClient, FakeHostPolicy, FIXED_CLOCK } from './fakes.js'

/** Delegates `find`/`delete` to a real fake repository but always rejects on
 * `save()` — regression coverage for a DB write failing (dropped connection,
 * pool exhaustion) after the Home Assistant call itself already succeeded. */
class SaveFailsRepository implements HomeAssistantLinkRepository {
  constructor(private readonly inner: FakeHomeAssistantLinkRepository) {}
  find(householdId: string) {
    return this.inner.find(householdId)
  }
  async save(): Promise<void> {
    throw new Error('connection dropped')
  }
  delete(householdId: string) {
    return this.inner.delete(householdId)
  }
}

function url() {
  const result = InstanceUrl.create('http://homeassistant.local:8123')
  if (!result.ok) throw new Error('bad fixture')
  return result.value
}

async function linkedRepo(direction: 'push' | 'pull' | 'two_way') {
  const links = new FakeHomeAssistantLinkRepository()
  const link = HomeAssistantLink.create({
    id: 'link-1',
    householdId: 'household-1',
    instanceUrl: url(),
    token: 'tok',
    createdAt: new Date(),
  })
  link.bindList('todo.courses', 'Courses', new Date())
  const directionResult = SyncDirection.create(direction)
  if (!directionResult.ok) throw new Error('bad fixture')
  link.changeDirection(directionResult.value, new Date())
  await links.save(link)
  return links
}

function item() {
  const quantity = Quantity.create(1, 'pièce')
  const source = ShoppingItemSource.create('manual')
  if (!quantity.ok || !source.ok) throw new Error('bad fixture')
  return ShoppingItem.create({
    id: 'item-1',
    householdId: 'household-1',
    name: 'Lait',
    quantity: quantity.value,
    source: source.value,
    createdAt: new Date(),
  })
}

test.group('ShoppingListMirror', () => {
  test('itemCreated() is a no-op with no link configured', async ({ assert }) => {
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(new FakeHomeAssistantLinkRepository(), client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemCreated(item())
    assert.lengthOf(client.calls, 0)
  })

  test('itemCreated() calls addItem when linked two_way', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemCreated(item())
    assert.isTrue(client.calls.some((c) => c.method === 'addItem'))
  })

  test('itemCreated() is a no-op in pull mode — a local write must never reach HA', async ({ assert }) => {
    const links = await linkedRepo('pull')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemCreated(item())
    assert.lengthOf(client.calls, 0)
  })

  test('itemUpdated() is a no-op when the item has no known uid yet', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemUpdated(item())
    assert.lengthOf(client.calls, 0)
  })

  test('itemUpdated() calls updateItem when the item has a uid', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    const withUid = item()
    withUid.markSynced('ha-1', new Date())
    await mirror.itemUpdated(withUid)
    assert.isTrue(client.calls.some((c) => c.method === 'updateItem'))
  })

  test('itemDeleted() is a no-op with no uid (never synced yet)', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemDeleted('household-1', null)
    assert.lengthOf(client.calls, 0)
  })

  test('itemDeleted() calls removeItem with a known uid', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemDeleted('household-1', 'ha-1')
    assert.isTrue(client.calls.some((c) => c.method === 'removeItem'))
  })

  test('a client failure is swallowed and recorded on the link, never thrown', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const failing = Object.assign(new RecordingHomeAssistantClient(), {
      addItem: async () => ({ ok: false as const, error: 'unreachable' as const }),
    })
    const mirror = new ShoppingListMirror(links, failing, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemCreated(item()) // must not throw
    const link = await links.find('household-1')
    assert.equal(link?.lastError, 'unreachable')
  })

  test('is a no-op when the host is not on the allowlist', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(false), FIXED_CLOCK)
    await mirror.itemCreated(item())
    assert.lengthOf(client.calls, 0)
  })

  test('a link-save failure after a successful call is swallowed, never thrown', async ({ assert }) => {
    const links = new SaveFailsRepository(await linkedRepo('two_way'))
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemCreated(item()) // must resolve even though links.save() rejects
    assert.isTrue(client.calls.some((c) => c.method === 'addItem'))
  })
})
