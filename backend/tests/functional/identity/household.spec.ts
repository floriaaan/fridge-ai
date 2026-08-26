import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'

async function signUp(client: ApiClient, email: string, name: string) {
  const response = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name })
  return response.headers()['set-cookie']
}

test.group('household: create, join, manage members', () => {
  test('a fresh user has no household', async ({ client, assert }) => {
    const cookie = await signUp(client, 'nohousehold@example.com', 'Nobody')
    const response = await client.get('/api/households/mine').headers({ cookie })
    response.assertStatus(200)
    response.assertBodyContains({ household: null })
  })

  test('create → mine → invite code visible to owner', async ({ client, assert }) => {
    const cookie = await signUp(client, 'owner@example.com', 'Owner')

    const create = await client.post('/api/households').headers({ cookie }).json({ name: 'Chez nous' })
    create.assertStatus(201)
    const inviteCode = create.body().household.inviteCode
    assert.isString(inviteCode)

    const mine = await client.get('/api/households/mine').headers({ cookie })
    mine.assertBodyContains({ household: { name: 'Chez nous', role: 'owner' } })
  })

  test('creating a second household for the same owner fails', async ({ client }) => {
    const cookie = await signUp(client, 'owner2@example.com', 'Owner2')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer A' })

    const second = await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer B' })
    second.assertStatus(409)
    second.assertBodyContains({ error: { type: 'already_in_household' } })
  })

  test('join with a valid invite code adds the member, without exposing the code to them', async ({
    client,
    assert,
  }) => {
    const ownerCookie = await signUp(client, 'owner3@example.com', 'Owner3')
    const create = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer partagé' })
    const inviteCode = create.body().household.inviteCode

    const memberCookie = await signUp(client, 'member3@example.com', 'Member3')
    const join = await client
      .post('/api/households/join')
      .headers({ cookie: memberCookie })
      .json({ inviteCode })
    join.assertStatus(200)
    join.assertBodyContains({ household: { role: 'member' } })
    assert.notProperty(join.body().household, 'inviteCode')
  })

  test('join with an invalid invite code returns 404', async ({ client }) => {
    const cookie = await signUp(client, 'joiner@example.com', 'Joiner')
    const response = await client
      .post('/api/households/join')
      .headers({ cookie })
      .json({ inviteCode: 'ZZZZ9999' })
    response.assertStatus(404)
  })

  test('owner removes a member', async ({ client }) => {
    const ownerCookie = await signUp(client, 'owner4@example.com', 'Owner4')
    const create = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer 4' })
    const inviteCode = create.body().household.inviteCode

    const memberCookie = await signUp(client, 'member4@example.com', 'Member4')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const mineAsOwner = await client.get('/api/households/mine').headers({ cookie: ownerCookie })
    const memberUserId = mineAsOwner
      .body()
      .household.members.find((m: { role: string }) => m.role === 'member').userId

    const remove = await client
      .delete(`/api/households/members/${memberUserId}`)
      .headers({ cookie: ownerCookie })
    remove.assertStatus(204)

    const memberSession = await client.get('/api/households/mine').headers({ cookie: memberCookie })
    memberSession.assertBodyContains({ household: null })
  })

  test('owner cannot leave, must delete', async ({ client }) => {
    const cookie = await signUp(client, 'owner5@example.com', 'Owner5')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer 5' })

    const leave = await client.post('/api/households/leave').headers({ cookie })
    leave.assertStatus(409)
    leave.assertBodyContains({ error: { type: 'owner_cannot_leave' } })

    const destroy = await client.delete('/api/households/mine').headers({ cookie })
    destroy.assertStatus(204)

    const mine = await client.get('/api/households/mine').headers({ cookie })
    mine.assertBodyContains({ household: null })
  })
})
