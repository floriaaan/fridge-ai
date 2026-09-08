// backend/tests/unit/application/home-assistant/sync-shopping-list.use-case.spec.ts
import { test } from '@japa/runner'
import { SyncShoppingList } from '#application/home-assistant/sync-shopping-list.use-case'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { SyncDirection } from '#domain/home-assistant/sync-direction.vo'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import {
  FakeHomeAssistantLinkRepository,
  FakeShoppingItemRepository,
  RecordingHomeAssistantClient,
  FailingListItemsClient,
  FailingUpdateItemClient,
  FIXED_CLOCK,
  SEQUENTIAL_IDS,
} from './fakes.js'

function url() {
  const result = InstanceUrl.create('http://homeassistant.local:8123')
  if (!result.ok) throw new Error('bad fixture')
  return result.value
}

async function linkedRepo(direction: 'push' | 'pull' | 'two_way', entityId = 'todo.courses') {
  const links = new FakeHomeAssistantLinkRepository()
  const link = HomeAssistantLink.create({
    id: 'link-1',
    householdId: 'household-1',
    instanceUrl: url(),
    token: 'tok',
    createdAt: new Date(),
  })
  link.bindList(entityId, 'Courses', new Date())
  const directionResult = SyncDirection.create(direction)
  if (!directionResult.ok) throw new Error('bad fixture')
  link.changeDirection(directionResult.value, new Date())
  await links.save(link)
  return links
}

function localItem(
  overrides: { id?: string; name?: string; haUid?: string | null; dirty?: boolean } = {},
) {
  const quantity = Quantity.create(1, 'pièce')
  const source = ShoppingItemSource.create('manual')
  if (!quantity.ok || !source.ok) throw new Error('bad fixture')
  const createdAt = new Date('2026-09-01T00:00:00.000Z')
  const item = ShoppingItem.create({
    id: overrides.id ?? 'item-1',
    householdId: 'household-1',
    name: overrides.name ?? 'Lait',
    quantity: quantity.value,
    source: source.value,
    createdAt,
  })
  if (overrides.haUid !== undefined && !overrides.dirty) {
    item.markSynced(overrides.haUid, new Date('2026-09-02T00:00:00.000Z')) // synced after creation → clean
  } else if (overrides.haUid !== undefined && overrides.dirty) {
    item.markSynced(overrides.haUid, new Date('2026-08-31T00:00:00.000Z')) // synced before an edit
    item.update({ name: item.name }, new Date('2026-09-03T00:00:00.000Z')) // bumps updatedAt past haSyncedAt
  }
  return item
}

test.group('SyncShoppingList', () => {
  test('no-op when no link is configured', async ({ assert }) => {
    const useCase = new SyncShoppingList(
      new FakeHomeAssistantLinkRepository(),
      new FakeShoppingItemRepository(),
      new RecordingHomeAssistantClient(),
      SEQUENTIAL_IDS('item'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({ householdId: 'household-1' })
    assert.isTrue(result.ok)
    if (result.ok) assert.isFalse(result.value.synced)
  })

  test('no-op when the link has no bound list yet', async ({ assert }) => {
    const links = new FakeHomeAssistantLinkRepository()
    await links.save(
      HomeAssistantLink.create({
        id: 'link-1',
        householdId: 'household-1',
        instanceUrl: url(),
        token: 'tok',
        createdAt: new Date(),
      }),
    )
    const client = new RecordingHomeAssistantClient()
    const result = await new SyncShoppingList(
      links,
      new FakeShoppingItemRepository(),
      client,
      SEQUENTIAL_IDS('item'),
      FIXED_CLOCK,
    ).execute({ householdId: 'household-1' })
    assert.isTrue(result.ok)
    assert.lengthOf(client.calls, 0)
  })

  test('push: a dirty item with a known uid gets update_item', async ({ assert }) => {
    const links = await linkedRepo('push')
    const items = new FakeShoppingItemRepository()
    const item = localItem({ haUid: 'ha-1', dirty: true })
    await items.save(item)
    const client = new RecordingHomeAssistantClient([
      { uid: 'ha-1', summary: 'Lait', description: null, status: 'needs_action' },
    ])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
      householdId: 'household-1',
    })

    const call = client.calls.find((c) => c.method === 'updateItem')
    assert.isDefined(call)
    // args: [connection, entityId, uid, patch] — the exact target of the
    // call matters, not just that some updateItem call happened, since a
    // wrong/dead uid here (as in the vanished-uid bug) would still show up
    // as "some call is updateItem".
    assert.equal(call?.args[1], 'todo.courses')
    assert.equal(call?.args[2], 'ha-1')
    assert.deepEqual(call?.args[3], {
      summary: 'Lait',
      description: '1 pièce',
      status: 'needs_action',
    })
  })

  test('push: a clean item with a known uid still gets update_item (push always overwrites HA)', async ({
    assert,
  }) => {
    const links = await linkedRepo('push')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ haUid: 'ha-1', dirty: false }))
    const client = new RecordingHomeAssistantClient([
      { uid: 'ha-1', summary: 'Lait', description: null, status: 'needs_action' },
    ])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
      householdId: 'household-1',
    })

    assert.isTrue(client.calls.some((c) => c.method === 'updateItem'))
  })

  test('push: an item whose uid vanished from HA is re-added, not left gone', async ({
    assert,
  }) => {
    const links = await linkedRepo('push')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ haUid: 'ha-gone', dirty: false }))
    const client = new RecordingHomeAssistantClient([]) // HA has nothing

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
      householdId: 'household-1',
    })

    assert.isTrue(client.calls.some((c) => c.method === 'addItem'))
    const reread = await items.findById('item-1')
    assert.isNull(reread?.haUid) // cleared, re-adopted by name next pass
  })

  test('push: never removes an HA item it does not own', async ({ assert }) => {
    const links = await linkedRepo('push')
    const items = new FakeShoppingItemRepository()
    const client = new RecordingHomeAssistantClient([
      {
        uid: 'foreign-1',
        summary: 'Something from a voice assistant',
        description: null,
        status: 'needs_action',
      },
    ])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
      householdId: 'household-1',
    })

    assert.isFalse(client.calls.some((c) => c.method === 'removeItem'))
  })

  test('pull: a dirty local item gets overwritten from HA, not pushed', async ({ assert }) => {
    const links = await linkedRepo('pull')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ haUid: 'ha-1', dirty: true, name: 'Lait (local edit)' }))
    const client = new RecordingHomeAssistantClient([
      { uid: 'ha-1', summary: 'Lait entier', description: '2 L', status: 'completed' },
    ])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
      householdId: 'household-1',
    })

    assert.isFalse(client.calls.some((c) => c.method === 'updateItem'))
    const reread = await items.findById('item-1')
    assert.equal(reread?.name, 'Lait entier')
    assert.isTrue(reread?.checked)
  })

  test('pull: an item whose uid vanished from HA is deleted locally', async ({ assert }) => {
    const links = await linkedRepo('pull')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ haUid: 'ha-gone', dirty: false }))
    const client = new RecordingHomeAssistantClient([])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
      householdId: 'household-1',
    })

    assert.isNull(await items.findById('item-1'))
  })

  test('pull: an HA item nobody owns locally is imported', async ({ assert }) => {
    const links = await linkedRepo('pull')
    const items = new FakeShoppingItemRepository()
    const client = new RecordingHomeAssistantClient([
      { uid: 'ha-new', summary: 'Pain', description: '1 pièce', status: 'needs_action' },
    ])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
      householdId: 'household-1',
    })

    const imported = await items.findByHousehold('household-1')
    assert.lengthOf(imported, 1)
    assert.equal(imported[0]?.name, 'Pain')
    assert.equal(imported[0]?.haUid, 'ha-new')
  })

  test('pull: a local-only item with no HA match is left alone, never pushed', async ({
    assert,
  }) => {
    const links = await linkedRepo('pull')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ name: 'Only here' }))
    const client = new RecordingHomeAssistantClient([])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
      householdId: 'household-1',
    })

    assert.isFalse(client.calls.some((c) => c.method === 'addItem'))
    assert.isNotNull(await items.findById('item-1'))
  })

  test('two_way: a brand-new local item with no uid and no HA match is added to HA', async ({
    assert,
  }) => {
    const links = await linkedRepo('two_way')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ name: 'Nouveau' }))
    const client = new RecordingHomeAssistantClient([])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
      householdId: 'household-1',
    })

    assert.isTrue(client.calls.some((c) => c.method === 'addItem'))
  })

  test('two_way: a no-uid local item and a same-named HA item adopt the uid, without pushing or overwriting', async ({
    assert,
  }) => {
    const links = await linkedRepo('two_way')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ name: 'Lait' }))
    const client = new RecordingHomeAssistantClient([
      { uid: 'ha-existing', summary: 'lait', description: null, status: 'needs_action' }, // case-insensitive match
    ])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
      householdId: 'household-1',
    })

    const reread = await items.findById('item-1')
    assert.equal(reread?.haUid, 'ha-existing')
    assert.isFalse(client.calls.some((c) => c.method === 'addItem'))
    assert.isFalse(client.calls.some((c) => c.method === 'updateItem'))
  })

  // The brief's Step 2 exercises two_way only through the uid-adoption and
  // push-new-item passes. Neither covers the `direction === 'two_way' &&
  // dirty` branch in reconcileKnownUids — the one branch where the dirty
  // rule actually decides push vs. pull for an item whose uid is already
  // known, and the defining behavior of two-way mode. Added per the
  // self-review mandate to exercise every matrix cell, not just hit 15
  // tests.
  test('two_way: a dirty item with a known uid is pushed to HA, local content wins', async ({
    assert,
  }) => {
    const links = await linkedRepo('two_way')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ haUid: 'ha-1', dirty: true, name: 'Lait (local edit)' }))
    const client = new RecordingHomeAssistantClient([
      { uid: 'ha-1', summary: 'Lait', description: null, status: 'needs_action' },
    ])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
      householdId: 'household-1',
    })

    const call = client.calls.find((c) => c.method === 'updateItem')
    assert.isDefined(call)
    assert.equal(call?.args[1], 'todo.courses')
    assert.equal(call?.args[2], 'ha-1')
    assert.deepEqual(call?.args[3], {
      summary: 'Lait (local edit)',
      description: '1 pièce',
      status: 'needs_action',
    })
    const reread = await items.findById('item-1')
    assert.equal(reread?.name, 'Lait (local edit)')
  })

  test('two_way: a clean item with a known uid is pulled from HA, not pushed', async ({
    assert,
  }) => {
    const links = await linkedRepo('two_way')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ haUid: 'ha-1', dirty: false }))
    const client = new RecordingHomeAssistantClient([
      { uid: 'ha-1', summary: 'Lait entier', description: '2 L', status: 'completed' },
    ])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({
      householdId: 'household-1',
    })

    assert.isFalse(client.calls.some((c) => c.method === 'updateItem'))
    const reread = await items.findById('item-1')
    assert.equal(reread?.name, 'Lait entier')
    assert.isTrue(reread?.checked)
  })

  test('a client failure aborts the reconcile and records the failure on the link', async ({
    assert,
  }) => {
    const links = await linkedRepo('two_way')
    const items = new FakeShoppingItemRepository()
    const result = await new SyncShoppingList(
      links,
      items,
      new FailingListItemsClient(),
      SEQUENTIAL_IDS('item'),
      FIXED_CLOCK,
    ).execute({ householdId: 'household-1' })

    assert.isFalse(result.ok)
    const link = await links.find('household-1')
    assert.equal(link?.lastError, 'unreachable')
  })

  // The "client failure" test above only fails `listItems`, before the `try`
  // block that runs the four passes even starts — it never exercises the
  // `push() → throw → catch → recordFailure` path. A failing `update_item`
  // mid-pass (a two-way, dirty, known-uid item — the case that pushes) is
  // the scenario that would also have caught the vanished-uid bug, where
  // push() was called with a dead uid before the code path was fixed.
  test('a failing update_item call aborts the reconcile mid-pass and records the failure', async ({
    assert,
  }) => {
    const links = await linkedRepo('two_way')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ haUid: 'ha-1', dirty: true }))
    const client = new FailingUpdateItemClient([
      { uid: 'ha-1', summary: 'Lait', description: null, status: 'needs_action' },
    ])

    const result = await new SyncShoppingList(
      links,
      items,
      client,
      SEQUENTIAL_IDS('item'),
      FIXED_CLOCK,
    ).execute({
      householdId: 'household-1',
    })

    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'unreachable')
    const link = await links.find('household-1')
    assert.equal(link?.lastError, 'unreachable')
    assert.isNull(link?.lastSyncAt) // never reached recordSync
  })

  test('a successful sync clears any previous error and stamps lastSyncAt', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const link = await links.find('household-1')
    link?.recordFailure('previous failure', new Date())
    if (link) await links.save(link)

    const items = new FakeShoppingItemRepository()
    await new SyncShoppingList(
      links,
      items,
      new RecordingHomeAssistantClient([]),
      SEQUENTIAL_IDS('item'),
      FIXED_CLOCK,
    ).execute({ householdId: 'household-1' })

    const reread = await links.find('household-1')
    assert.isNull(reread?.lastError)
    assert.isNotNull(reread?.lastSyncAt)
  })
})
