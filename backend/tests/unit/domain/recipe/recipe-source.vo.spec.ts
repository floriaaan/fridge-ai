import { test } from '@japa/runner'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'

test.group('RecipeSource', () => {
  test('accepts "ai" and "user"', ({ assert }) => {
    assert.isTrue(RecipeSource.create('ai').ok)
    assert.isTrue(RecipeSource.create('user').ok)
  })

  test('rejects an unknown source', ({ assert }) => {
    assert.isFalse(RecipeSource.create('community').ok)
  })
})
