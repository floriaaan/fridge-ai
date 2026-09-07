import { test } from '@japa/runner'
import { SyncDirection } from '#domain/home-assistant/sync-direction.vo'

test.group('SyncDirection', () => {
  test('accepts "push", "pull", "two_way"', ({ assert }) => {
    assert.isTrue(SyncDirection.create('push').ok)
    assert.isTrue(SyncDirection.create('pull').ok)
    assert.isTrue(SyncDirection.create('two_way').ok)
  })

  test('rejects an unknown direction', ({ assert }) => {
    assert.isFalse(SyncDirection.create('sideways').ok)
  })

  test('twoWay() is the default and never fails', ({ assert }) => {
    assert.equal(SyncDirection.twoWay().value, 'two_way')
  })
})
