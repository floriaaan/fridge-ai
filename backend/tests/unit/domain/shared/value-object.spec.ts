import { test } from '@japa/runner'
import { ValueObject } from '#domain/shared/value-object'

class TestVo extends ValueObject<{ value: string }> {
  static create(value: string): TestVo {
    return new TestVo({ value })
  }
  get value(): string {
    return this.props.value
  }
}

test.group('ValueObject', () => {
  test('two value objects with equal props are equal', ({ assert }) => {
    assert.isTrue(TestVo.create('a').equals(TestVo.create('a')))
  })

  test('two value objects with different props are not equal', ({ assert }) => {
    assert.isFalse(TestVo.create('a').equals(TestVo.create('b')))
  })
})
