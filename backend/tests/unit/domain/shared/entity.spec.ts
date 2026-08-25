import { test } from '@japa/runner'
import { Entity } from '#domain/shared/entity'

class TestEntity extends Entity<string> {
  static create(id: string): TestEntity {
    return new TestEntity(id)
  }
}

test.group('Entity', () => {
  test('two entities with the same id and class are equal', ({ assert }) => {
    assert.isTrue(TestEntity.create('a').equals(TestEntity.create('a')))
  })

  test('two entities with different ids are not equal', ({ assert }) => {
    assert.isFalse(TestEntity.create('a').equals(TestEntity.create('b')))
  })

  test('an entity does not equal a non-entity', ({ assert }) => {
    assert.isFalse(TestEntity.create('a').equals({ id: 'a' }))
  })
})
