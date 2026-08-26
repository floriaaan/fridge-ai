import { test } from '@japa/runner'

test.group('identity: sign-up, session, sign-out, auth methods', () => {
  test('GET /api/auth/methods lists password when PocketID is not configured', async ({
    client,
  }) => {
    const response = await client.get('/api/auth/methods')
    response.assertStatus(200)
    response.assertBodyContains({ methods: [{ id: 'password', enabled: true }] })
  })

  test('GET /api/session returns null before sign-in', async ({ client }) => {
    const response = await client.get('/api/session')
    response.assertStatus(200)
    response.assertBodyContains({ user: null })
  })

  test('sign-up then session reflects the new user, sign-out clears it', async ({
    client,
    assert,
  }) => {
    const signUp = await client.post('/api/auth/sign-up/email').json({
      email: 'alice@example.com',
      password: 'correct-horse-battery-staple',
      name: 'Alice',
    })
    signUp.assertStatus(200)

    const cookie = signUp.headers()['set-cookie']
    assert.isDefined(cookie)
    if (!cookie) throw new Error('set-cookie header missing')

    const session = await client.get('/api/session').headers({ cookie })
    session.assertStatus(200)
    session.assertBodyContains({ user: { email: 'alice@example.com', name: 'Alice' } })

    const signOut = await client.post('/api/auth/sign-out').headers({ cookie })
    signOut.assertStatus(200)

    const afterSignOut = await client.get('/api/session').headers({ cookie })
    afterSignOut.assertBodyContains({ user: null })
  })
})
