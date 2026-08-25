import { test } from '@japa/runner'

test.group('GET /health', () => {
  test('responds with 200 and status ok', async ({ client }) => {
    const response = await client.get('/health')
    response.assertStatus(200)
    response.assertBodyContains({ status: 'ok' })
  })
})
