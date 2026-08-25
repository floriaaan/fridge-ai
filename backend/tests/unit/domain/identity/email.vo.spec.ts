import { test } from '@japa/runner'
import { Email } from '#domain/identity/email.vo'

test.group('Email', () => {
  test('accepts a well-formed address, normalized to lowercase', ({ assert }) => {
    const result = Email.create('  Alice@Example.com  ')
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value.value, 'alice@example.com')
  })

  test('rejects a string without an @', ({ assert }) => {
    const result = Email.create('not-an-email')
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error.field, 'email')
  })
})
