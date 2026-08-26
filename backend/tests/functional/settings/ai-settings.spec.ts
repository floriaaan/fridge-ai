import { test } from '@japa/runner'

async function signUp(client: import('@japa/api-client').ApiClient, email: string) {
  const response = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  return response.headers()['set-cookie']
}

test.group('settings: GET/PATCH /api/settings/ai', () => {
  test('GET reflects the env default when no owner has changed it', async ({ client }) => {
    const cookie = await signUp(client, 'settings-read@example.com')
    const response = await client.get('/api/settings/ai').headers({ cookie })
    response.assertStatus(200)
    response.assertBodyContains({ source: 'environment' })
  })

  test('PATCH is rejected for a user with no household', async ({ client }) => {
    const cookie = await signUp(client, 'settings-no-household@example.com')
    const response = await client.patch('/api/settings/ai').headers({ cookie }).json({ provider: 'gemini' })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'not_owner' } })
  })

  test('PATCH succeeds for a household owner switching to a configured provider', async ({
    client,
    assert,
  }) => {
    const cookie = await signUp(client, 'settings-owner@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer settings' })

    const response = await client.patch('/api/settings/ai').headers({ cookie }).json({ provider: 'gemini' })
    response.assertStatus(200)
    response.assertBodyContains({ activeProvider: 'gemini', source: 'database' })

    const read = await client.get('/api/settings/ai').headers({ cookie })
    read.assertBodyContains({ activeProvider: 'gemini' })
  })

  test('PATCH rejects a provider with no credentials configured', async ({ client }) => {
    const cookie = await signUp(client, 'settings-owner2@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer settings 2' })

    const response = await client.patch('/api/settings/ai').headers({ cookie }).json({ provider: 'openai' })
    response.assertStatus(422)
    response.assertBodyContains({ error: { type: 'provider_not_configured' } })
  })
})
