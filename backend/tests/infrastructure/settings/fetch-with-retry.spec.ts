import { test } from '@japa/runner'
import { fetchWithRetry } from '#infrastructure/settings/fetch-with-retry'

test.group('fetchWithRetry', () => {
  test('retries once after a network error, then returns the successful response', async ({
    assert,
  }) => {
    const originalFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = (async () => {
      calls += 1
      if (calls === 1) throw new Error('ECONNREFUSED')
      return new Response('ok', { status: 200 })
    }) as typeof fetch

    try {
      const response = await fetchWithRetry('http://example.test', {}, 1, 0)
      assert.equal(calls, 2)
      assert.equal(response.status, 200)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('rethrows once retries are exhausted', async ({ assert }) => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      throw new Error('EHOSTUNREACH')
    }) as typeof fetch

    try {
      await assert.rejects(() => fetchWithRetry('http://example.test', {}, 1, 0), 'EHOSTUNREACH')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
