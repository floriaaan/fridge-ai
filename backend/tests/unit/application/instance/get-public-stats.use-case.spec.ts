import { test } from '@japa/runner'
import { GetPublicStats } from '#application/instance/get-public-stats.use-case'
import type { PublicStatsPort } from '#domain/instance/interfaces/public-stats.interface'

class FakePublicStatsPort implements PublicStatsPort {
  calls = 0
  async getStats() {
    this.calls++
    return { households: 3, productsConsumed: 42, recipesGenerated: 7 }
  }
}

test.group('GetPublicStats', () => {
  test('disabled: returns null without touching the port', async ({ assert }) => {
    const port = new FakePublicStatsPort()

    assert.isNull(await new GetPublicStats(port, false).execute())
    assert.equal(port.calls, 0)
  })

  test('enabled: returns whatever the port answers', async ({ assert }) => {
    const port = new FakePublicStatsPort()

    assert.deepEqual(await new GetPublicStats(port, true).execute(), {
      households: 3,
      productsConsumed: 42,
      recipesGenerated: 7,
    })
  })
})
