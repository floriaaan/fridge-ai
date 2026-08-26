import { test } from '@japa/runner'
import { Recipe } from '#domain/recipe/recipe.aggregate'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'

function buildRecipe() {
  const source = RecipeSource.create('user')
  if (!source.ok) throw new Error('unreachable')

  return Recipe.create({
    id: 'rc_1',
    householdId: 'h_1',
    title: 'Gratin de courgettes',
    source: source.value,
    instructions: 'Couper, cuire, gratiner.',
    ingredients: [{ id: 'ri_1', label: 'Courgette', quantity: 2, unit: 'piece' }],
    createdAt: new Date('2026-08-26T10:00:00Z'),
  })
}

test.group('Recipe', () => {
  test('create() defaults optional fields', ({ assert }) => {
    const recipe = buildRecipe()
    assert.isNull(recipe.description)
    assert.isNull(recipe.preparationTime)
    assert.isNull(recipe.imageKey)
    assert.deepEqual(recipe.tags, [])
  })

  test('create() builds internal RecipeIngredient entities scoped to the recipe', ({ assert }) => {
    const recipe = buildRecipe()
    assert.lengthOf(recipe.ingredients, 1)
    assert.equal(recipe.ingredients[0]?.recipeId, recipe.id)
    assert.equal(recipe.ingredients[0]?.label, 'Courgette')
    assert.isNull(recipe.ingredients[0]?.productId)
  })
})
