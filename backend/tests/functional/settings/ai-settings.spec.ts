import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

async function signUp(client: import('@japa/api-client').ApiClient, email: string) {
  const response = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  return response.headers()['set-cookie']
}

test.group('settings: GET/PATCH /api/settings/ai', (group) => {
  group.each.setup(() => db.beginGlobalTransaction())
  group.each.teardown(() => db.rollbackGlobalTransaction())

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

  test('PATCH with an invalid schema returns a validation error, not a 500', async ({ client }) => {
    // Regression test for the broken `vine.messagesProvider` (a bare function
    // instead of an object implementing `getMessage`): every vine schema
    // failure used to crash with `TypeError: messagesProvider.getMessage is
    // not a function`, which escaped as an unhandled exception and rendered
    // as a 500. This codebase's exception handler (see
    // `src/presentation/shared/exception-handler.ts#renderValidationErrorAsJSON`)
    // deliberately reports VineJS validation failures using vine's own
    // `error.status`, which is 422 — so the correct, non-crashing status here
    // is 422 (matching every other schema-validation test in this suite,
    // e.g. `receipt: scan with no file returns 422`), not the app's 400
    // used only for domain-level `ValidationError`s.
    const cookie = await signUp(client, 'settings-invalid-schema@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer settings invalid' })

    const response = await client
      .patch('/api/settings/ai')
      .headers({ cookie })
      .json({ provider: 'not-a-real-provider' })
    response.assertStatus(422)
    response.assertBodyContains({ error: { type: 'validation_failed' } })
  })
})
