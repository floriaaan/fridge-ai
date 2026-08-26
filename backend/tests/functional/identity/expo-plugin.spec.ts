import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

test.group('identity: expo() plugin does not break email/password auth', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('sign-up still returns a session cookie', async ({ client }) => {
    const response = await client.post('/api/auth/sign-up/email').json({
      email: 'expo-plugin-check@example.com',
      password: 'correct-horse-battery-staple',
      name: 'Test',
    })
    response.assertStatus(200)
    const cookie = response.headers()['set-cookie']
    if (!cookie) throw new Error('set-cookie header missing')
  })
})
