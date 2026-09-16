import { test } from '@japa/runner'

test.group('GET /api/public/stats', () => {
  // PUBLIC_STATS_ENABLED is unset in the test environment: the endpoint is
  // opt-in, so the default must answer as if it did not exist.
  test('is 404 when the instance has not opted in', async ({ client }) => {
    const response = await client.get('/api/public/stats')
    response.assertStatus(404)
    response.assertBodyContains({ error: { type: 'not_found' } })
  })
})
