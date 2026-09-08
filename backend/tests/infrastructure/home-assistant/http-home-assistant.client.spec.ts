import { test } from '@japa/runner'
import { HttpHomeAssistantClient } from '#infrastructure/home-assistant/http-home-assistant.client'

const connection = { instanceUrl: 'http://homeassistant.local:8123', token: 'tok' }

test.group('HttpHomeAssistantClient', (group) => {
  const originalFetch = globalThis.fetch
  group.each.teardown(() => {
    globalThis.fetch = originalFetch
  })

  test('ping() succeeds on a 200', async ({ assert }) => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'API running.' }))) as typeof fetch
    const result = await new HttpHomeAssistantClient().ping(connection)
    assert.isTrue(result.ok)
  })

  test('ping() maps a 401 to "unauthorized"', async ({ assert }) => {
    globalThis.fetch = (async () => new Response('', { status: 401 })) as typeof fetch
    const result = await new HttpHomeAssistantClient().ping(connection)
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'unauthorized')
  })

  test('ping() maps a network failure to "unreachable"', async ({ assert }) => {
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED')
    }) as typeof fetch
    const result = await new HttpHomeAssistantClient().ping(connection)
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'unreachable')
  })

  test('listTodoEntities() keeps only todo.* states', async ({ assert }) => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          { entity_id: 'todo.courses', attributes: { friendly_name: 'Courses' } },
          { entity_id: 'light.salon', attributes: { friendly_name: 'Salon' } },
        ]),
      )) as typeof fetch
    const result = await new HttpHomeAssistantClient().listTodoEntities(connection)
    assert.isTrue(result.ok)
    if (result.ok) {
      assert.lengthOf(result.value, 1)
      assert.equal(result.value[0].entityId, 'todo.courses')
      assert.equal(result.value[0].friendlyName, 'Courses')
    }
  })

  test('listItems() reads the service_response envelope for the given entity', async ({ assert }) => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          service_response: {
            'todo.courses': {
              items: [{ uid: 'u1', summary: 'Lait', description: '2 L', status: 'needs_action' }],
            },
          },
        }),
      )) as typeof fetch
    const result = await new HttpHomeAssistantClient().listItems(connection, 'todo.courses')
    assert.isTrue(result.ok)
    if (result.ok) {
      assert.lengthOf(result.value, 1)
      assert.equal(result.value[0].uid, 'u1')
      assert.equal(result.value[0].description, '2 L')
    }
  })

  test('addItem()/updateItem()/removeItem() succeed on a 200', async ({ assert }) => {
    globalThis.fetch = (async () => new Response('[]')) as typeof fetch
    const client = new HttpHomeAssistantClient()
    assert.isTrue((await client.addItem(connection, 'todo.courses', { summary: 'Pain', description: '1 pièce' })).ok)
    assert.isTrue((await client.updateItem(connection, 'todo.courses', 'u1', { status: 'completed' })).ok)
    assert.isTrue((await client.removeItem(connection, 'todo.courses', 'u1')).ok)
  })

  test('a non-2xx, non-401/403 status maps to "unexpected_response"', async ({ assert }) => {
    globalThis.fetch = (async () => new Response('', { status: 500 })) as typeof fetch
    const result = await new HttpHomeAssistantClient().ping(connection)
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'unexpected_response')
  })
})
