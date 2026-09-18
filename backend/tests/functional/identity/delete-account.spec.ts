import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'

async function signUp(client: ApiClient, email: string, name: string) {
  const response = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name })
  const cookie = response.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  return cookie
}

function deleteAccount(client: ApiClient, cookie: string) {
  return client
    .post('/api/auth/delete-user')
    .headers({ cookie })
    .json({ password: 'correct-horse-battery-staple' })
}

test.group('account deletion: household cleanup', () => {
  test('solo owner deletion also deletes their household', async ({ client }) => {
    const cookie = await signUp(client, 'solo-owner@example.com', 'Solo Owner')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer solo' })

    const response = await deleteAccount(client, cookie)
    response.assertStatus(200)

    const signIn = await client
      .post('/api/auth/sign-in/email')
      .json({ email: 'solo-owner@example.com', password: 'correct-horse-battery-staple' })
    signIn.assertStatus(401)
  })

  test('plain member deletion just leaves the household', async ({ client }) => {
    const ownerCookie = await signUp(client, 'del-owner@example.com', 'Del Owner')
    const create = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer del' })
    const inviteCode = create.body().household.inviteCode

    const memberCookie = await signUp(client, 'del-member@example.com', 'Del Member')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const response = await deleteAccount(client, memberCookie)
    response.assertStatus(200)

    const mineAsOwner = await client.get('/api/households/mine').headers({ cookie: ownerCookie })
    mineAsOwner.assertBodyContains({ household: { name: 'Foyer del' } })
  })

  test('owner of a multi-member household must transfer ownership before deleting', async ({
    client,
  }) => {
    const ownerCookie = await signUp(client, 'blocked-owner@example.com', 'Blocked Owner')
    const create = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer bloqué' })
    const inviteCode = create.body().household.inviteCode

    const memberCookie = await signUp(client, 'blocked-member@example.com', 'Blocked Member')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const response = await deleteAccount(client, ownerCookie)
    response.assertStatus(400)

    const mine = await client.get('/api/households/mine').headers({ cookie: ownerCookie })
    mine.assertBodyContains({ household: { name: 'Foyer bloqué' } })
  })
})
