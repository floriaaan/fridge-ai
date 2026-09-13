import { test } from '@japa/runner'
import { OutcomeKind } from '#domain/fridge/outcome-kind.vo'

test.group('OutcomeKind', () => {
  test('accepts consumed and discarded', ({ assert }) => {
    for (const raw of ['consumed', 'discarded']) {
      const result = OutcomeKind.create(raw)
      assert.isTrue(result.ok)
      if (result.ok) assert.equal(result.value.value, raw)
    }
  })

  test('rejects anything else, including the correction a DELETE stands for', ({ assert }) => {
    const result = OutcomeKind.create('deleted')
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error.field, 'kind')
  })
})
