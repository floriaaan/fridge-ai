import { test } from '@japa/runner'
import { sanitizeOtlpPayload } from '#infrastructure/telemetry/otlp-sanitizer'

const attribution = { pseudoUserId: 'deadbeefdeadbeef' }

function tracePayload(spanAttributes: { key: string; value: unknown }[]) {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'fridge-ai-mobile' } },
            { key: 'device.model.identifier', value: { stringValue: 'iPhone16,2' } },
          ],
        },
        scopeSpans: [
          {
            spans: [
              {
                traceId: '0af7651916cd43dd8448eb211c80319c',
                spanId: 'b7ad6b7169203331',
                name: 'GET /api/households/mine',
                attributes: spanAttributes,
              },
            ],
          },
        ],
      },
    ],
  }
}

function attributesOf(
  payload: Record<string, unknown>,
  path: 'resource' | 'span',
): { key: string; value: any }[] {
  const resource = (payload.resourceSpans as any[])[0]
  return path === 'resource'
    ? resource.resource.attributes
    : resource.scopeSpans[0].spans[0].attributes
}

test.group('sanitizeOtlpPayload', () => {
  test('keeps allowlisted span attributes and drops everything else', ({ assert }) => {
    const result = sanitizeOtlpPayload(
      'traces',
      tracePayload([
        { key: 'http.request.method', value: { stringValue: 'GET' } },
        { key: 'authorization', value: { stringValue: 'Bearer sk-live-123' } },
        { key: 'http.request.header.cookie', value: { stringValue: 'session=abc' } },
      ]),
      attribution,
    )

    const keys = attributesOf(result!, 'span').map((attribute) => attribute.key)
    assert.deepEqual(keys, ['http.request.method'])
  })

  test('drops device identifiers and stamps server-side resource attributes', ({ assert }) => {
    const result = sanitizeOtlpPayload('traces', tracePayload([]), attribution)

    const resourceAttributes = attributesOf(result!, 'resource')
    const keys = resourceAttributes.map((attribute) => attribute.key)
    assert.notInclude(keys, 'device.model.identifier')
    assert.include(keys, 'service.name')
    assert.include(keys, 'telemetry.source')
    assert.include(keys, 'enduser.pseudo.id')
  })

  test('truncates oversized attribute values', ({ assert }) => {
    const result = sanitizeOtlpPayload(
      'traces',
      tracePayload([{ key: 'exception.message', value: { stringValue: 'x'.repeat(5_000) } }]),
      attribution,
    )

    const value = attributesOf(result!, 'span')[0]!.value.stringValue as string
    assert.isBelow(value.length, 600)
  })

  test('drops non-scalar attribute values', ({ assert }) => {
    const result = sanitizeOtlpPayload(
      'traces',
      tracePayload([
        { key: 'app.operation', value: { kvlistValue: { values: [{ key: 'password' }] } } },
      ]),
      attribution,
    )

    assert.lengthOf(attributesOf(result!, 'span'), 0)
  })

  test('keeps trace and span ids on log records so logs stitch to spans', ({ assert }) => {
    const result = sanitizeOtlpPayload(
      'logs',
      {
        resourceLogs: [
          {
            resource: { attributes: [] },
            scopeLogs: [
              {
                logRecords: [
                  {
                    severityText: 'ERROR',
                    body: { stringValue: 'household read failed' },
                    traceId: '0af7651916cd43dd8448eb211c80319c',
                    spanId: 'b7ad6b7169203331',
                  },
                ],
              },
            ],
          },
        ],
      },
      attribution,
    )

    const record = (result!.resourceLogs as any[])[0].scopeLogs[0].logRecords[0]
    assert.equal(record.traceId, '0af7651916cd43dd8448eb211c80319c')
    assert.equal(record.spanId, 'b7ad6b7169203331')
  })

  test('returns null for a payload with nothing forwardable', ({ assert }) => {
    assert.isNull(sanitizeOtlpPayload('traces', { resourceSpans: [] }, attribution))
    assert.isNull(sanitizeOtlpPayload('traces', 'not-an-object', attribution))
  })
})
