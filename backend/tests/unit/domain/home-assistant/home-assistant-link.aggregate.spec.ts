import { test } from '@japa/runner'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { SyncDirection } from '#domain/home-assistant/sync-direction.vo'

function url(raw: string): InstanceUrl {
  const result = InstanceUrl.create(raw)
  if (!result.ok) throw new Error('bad fixture URL')
  return result.value
}

test.group('HomeAssistantLink', () => {
  test('create() defaults to two_way, enabled, no list bound', ({ assert }) => {
    const now = new Date('2026-09-01T00:00:00.000Z')
    const link = HomeAssistantLink.create({
      id: 'link-1',
      householdId: 'household-1',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'abc',
      createdAt: now,
    })
    assert.equal(link.direction.value, 'two_way')
    assert.isTrue(link.enabled)
    assert.isNull(link.todoEntityId)
    assert.isNull(link.todoEntityName)
    assert.isNull(link.lastSyncAt)
    assert.isNull(link.lastError)
  })

  test('bindList() sets both the id and the friendly name', ({ assert }) => {
    const link = HomeAssistantLink.create({
      id: 'link-1',
      householdId: 'household-1',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'abc',
      createdAt: new Date(),
    })
    link.bindList('todo.courses', 'Courses', new Date())
    assert.equal(link.todoEntityId, 'todo.courses')
    assert.equal(link.todoEntityName, 'Courses')
  })

  test('recordSync() clears a previous error', ({ assert }) => {
    const link = HomeAssistantLink.create({
      id: 'link-1',
      householdId: 'household-1',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'abc',
      createdAt: new Date(),
    })
    link.recordFailure('boom', new Date())
    assert.equal(link.lastError, 'boom')
    const syncedAt = new Date('2026-09-02T00:00:00.000Z')
    link.recordSync(syncedAt)
    assert.isNull(link.lastError)
    assert.equal(link.lastSyncAt, syncedAt)
  })

  test('recordFailure() truncates to 500 characters', ({ assert }) => {
    const link = HomeAssistantLink.create({
      id: 'link-1',
      householdId: 'household-1',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'abc',
      createdAt: new Date(),
    })
    link.recordFailure('x'.repeat(600), new Date())
    assert.equal(link.lastError?.length, 500)
  })

  test('changeDirection() and setEnabled() update independently', ({ assert }) => {
    const link = HomeAssistantLink.create({
      id: 'link-1',
      householdId: 'household-1',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'abc',
      createdAt: new Date(),
    })
    const push = SyncDirection.create('push')
    if (!push.ok) throw new Error('bad fixture direction')
    link.changeDirection(push.value, new Date())
    link.setEnabled(false, new Date())
    assert.equal(link.direction.value, 'push')
    assert.isFalse(link.enabled)
  })
})
