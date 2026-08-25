import { test } from '@japa/runner'
import { Result } from '#domain/shared/result'

test.group('Result', () => {
  test('ok() produces an ok result carrying the value', ({ assert }) => {
    const result = Result.ok(42)
    assert.isTrue(result.ok)
    assert.equal(result.value, 42)
  })

  test('err() produces an err result carrying the error', ({ assert }) => {
    const result = Result.err('boom')
    assert.isFalse(result.ok)
    assert.equal(result.error, 'boom')
  })
})
