import { test } from '@japa/runner'

test.group('GET /api/public/instance', () => {
  // INSTANCE_MODE/INSTANCE_NAME are unset in the test environment: unlike
  // public stats, this endpoint is not opt-in, so it must still answer.
  test('defaults to self-hosted with no name', async ({ client, assert }) => {
    const response = await client.get('/api/public/instance')
    response.assertStatus(200)
    response.assertBodyContains({ mode: 'self-hosted', name: null })
    assert.isString(response.body().version)
  })
})
