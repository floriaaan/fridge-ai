import { test } from '@japa/runner'

/**
 * The relay is off unless `TELEMETRY_INGEST_ENABLED=true`, which is also the
 * test environment's state — so this asserts the property that actually
 * matters for the app: an unconfigured or disabled observability stack
 * answers cleanly instead of erroring or hanging.
 */
test.group('POST /api/telemetry/v1/:signal', () => {
  test('answers 404 while the relay is disabled', async ({ client }) => {
    const response = await client.post('/api/telemetry/v1/traces').json({ resourceSpans: [] })
    response.assertStatus(404)
  })

  test('rejects an unknown signal', async ({ client }) => {
    const response = await client.post('/api/telemetry/v1/profiles').json({})
    response.assertStatus(404)
  })
})
