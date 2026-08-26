import { test } from '@japa/runner'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { UuidIdGenerator } from '#infrastructure/shared/uuid-id-generator'

test.group('InviteCode', () => {
  test('accepts an 8-character alphanumeric code, normalized to uppercase', ({ assert }) => {
    const result = InviteCode.create('k3f9qx2a')
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value.value, 'K3F9QX2A')
  })

  test('rejects a code that is not 8 characters', ({ assert }) => {
    const result = InviteCode.create('short')
    assert.isFalse(result.ok)
  })

  test('generate() produces a valid 8-character code', ({ assert }) => {
    const code = InviteCode.generate(new UuidIdGenerator())
    assert.match(code.value, /^[A-Z0-9]{8}$/)
  })

  test('generate() does not collide across codes generated in the same millisecond', ({
    assert,
  }) => {
    // Regression test: UuidIdGenerator is backed by uuid's monotonic v7,
    // which holds most of the id constant within a millisecond — slicing
    // the wrong region of the id produces identical codes back-to-back.
    // 50 calls execute well within a single millisecond on any real clock.
    const idGenerator = new UuidIdGenerator()
    const codes = new Set(Array.from({ length: 50 }, () => InviteCode.generate(idGenerator).value))
    assert.equal(codes.size, 50)
  })
})
