import { test } from '@japa/runner'
import { DiscardReason } from '#domain/fridge/discard-reason.vo'

test.group('DiscardReason', () => {
  test('accepts the four reasons', ({ assert }) => {
    for (const raw of ['expired', 'spoiled', 'disliked', 'other']) {
      assert.isTrue(DiscardReason.create(raw).ok)
    }
  })

  test('rejects an unknown reason', ({ assert }) => {
    const result = DiscardReason.create('moldy')
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error.field, 'discardReason')
  })
})
