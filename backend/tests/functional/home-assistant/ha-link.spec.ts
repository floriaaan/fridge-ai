import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

async function signUp(client: import('@japa/api-client').ApiClient, email: string) {
  const response = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  const cookie = response.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  return cookie
}

test.group('home-assistant: /api/settings/home-assistant, /api/shopping-items/sync', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('GET reflects "not configured" before any link exists', async ({ client }) => {
    const cookie = await signUp(client, 'ha-get@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer HA' })

    const response = await client.get('/api/settings/home-assistant').headers({ cookie })
    response.assertStatus(200)
    response.assertBodyContains({ configured: false, tokenSet: false })
  })

  test('PUT is rejected for a household member who is not the owner', async ({ client }) => {
    const ownerCookie = await signUp(client, 'ha-owner-1@example.com')
    const householdResponse = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer HA' })
    const inviteCode = householdResponse.body().household.inviteCode

    const memberCookie = await signUp(client, 'ha-member-1@example.com')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const response = await client
      .put('/api/settings/home-assistant')
      .headers({ cookie: memberCookie })
      .json({ instanceUrl: 'http://homeassistant.local:8123', token: 'tok' })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'not_owner' } })
  })

  test('POST /discover is rejected for a non-owner', async ({ client }) => {
    const ownerCookie = await signUp(client, 'ha-owner-2@example.com')
    const householdResponse = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer HA' })
    const inviteCode = householdResponse.body().household.inviteCode

    const memberCookie = await signUp(client, 'ha-member-2@example.com')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const response = await client
      .post('/api/settings/home-assistant/discover')
      .headers({ cookie: memberCookie })
      .json({})
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'not_owner' } })
  })

  test('PATCH is rejected for a non-owner', async ({ client }) => {
    const ownerCookie = await signUp(client, 'ha-owner-3@example.com')
    const householdResponse = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer HA' })
    const inviteCode = householdResponse.body().household.inviteCode

    const memberCookie = await signUp(client, 'ha-member-3@example.com')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const response = await client
      .patch('/api/settings/home-assistant')
      .headers({ cookie: memberCookie })
      .json({ enabled: false })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'not_owner' } })
  })

  test('DELETE is rejected for a non-owner', async ({ client }) => {
    const ownerCookie = await signUp(client, 'ha-owner-4@example.com')
    const householdResponse = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer HA' })
    const inviteCode = householdResponse.body().household.inviteCode

    const memberCookie = await signUp(client, 'ha-member-4@example.com')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const response = await client
      .delete('/api/settings/home-assistant')
      .headers({ cookie: memberCookie })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'not_owner' } })
  })

  test('DELETE with no link configured returns 404 link_not_found', async ({ client }) => {
    const cookie = await signUp(client, 'ha-delete-none@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer HA' })

    const response = await client.delete('/api/settings/home-assistant').headers({ cookie })
    response.assertStatus(404)
    response.assertBodyContains({ error: { type: 'link_not_found' } })
  })

  test('POST /shopping-items/sync with no link configured is a no-op success', async ({
    client,
  }) => {
    const cookie = await signUp(client, 'ha-sync-none@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer HA' })

    const response = await client.post('/api/shopping-items/sync').headers({ cookie })
    response.assertStatus(200)
    response.assertBodyContains({ synced: false })
  })

  test('every route 401s with no session', async ({ client }) => {
    const get = await client.get('/api/settings/home-assistant')
    get.assertStatus(401)

    const put = await client.put('/api/settings/home-assistant').json({})
    put.assertStatus(401)

    const discover = await client.post('/api/settings/home-assistant/discover').json({})
    discover.assertStatus(401)

    const patch = await client.patch('/api/settings/home-assistant').json({})
    patch.assertStatus(401)

    const del = await client.delete('/api/settings/home-assistant')
    del.assertStatus(401)

    const sync = await client.post('/api/shopping-items/sync')
    sync.assertStatus(401)
  })
})
