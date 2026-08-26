import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidRecipeRepository } from '#infrastructure/database/recipe/recipe.repository'
import { Recipe } from '#domain/recipe/recipe.aggregate'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'

async function createUser(id: string, email: string) {
  await db.table('user').insert({
    id,
    name: email,
    email,
    email_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  })
}

async function createHousehold(id: string, ownerId: string) {
  await db.table('household').insert({
    id,
    name: 'Test household',
    owner_id: ownerId,
    invite_code: id.slice(0, 8).toUpperCase().padEnd(8, '0'),
    created_at: new Date(),
    updated_at: new Date(),
  })
}

function buildRecipe(id: string, householdId: string, ingredientCount = 1) {
  const source = RecipeSource.create('user')
  if (!source.ok) throw new Error('unreachable')

  return Recipe.create({
    id,
    householdId,
    title: 'Gratin de courgettes',
    source: source.value,
    instructions: 'Couper, cuire, gratiner.',
    ingredients: Array.from({ length: ingredientCount }, (_, i) => ({
      id: `${id}-ing-${i}`,
      label: `Ingrédient ${i}`,
      quantity: 1,
      unit: 'piece',
    })),
    createdAt: new Date(),
  })
}

test.group('LucidRecipeRepository', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('save() then findById() round-trips a recipe with its ingredients', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')

    const repository = new LucidRecipeRepository()
    await repository.save(buildRecipe('rc_1', 'h_1', 2))

    const found = await repository.findById('rc_1')
    assert.equal(found?.title, 'Gratin de courgettes')
    assert.lengthOf(found?.ingredients ?? [], 2)
  })

  test('findByHousehold() scopes to the household', async ({ assert }) => {
    await createUser('u_2', 'owner2@example.com')
    await createHousehold('h_2', 'u_2')
    await createUser('u_3', 'owner3@example.com')
    await createHousehold('h_3', 'u_3')

    const repository = new LucidRecipeRepository()
    await repository.save(buildRecipe('rc_2', 'h_2'))
    await repository.save(buildRecipe('rc_3', 'h_3'))

    const recipes = await repository.findByHousehold('h_2')
    assert.lengthOf(recipes, 1)
    assert.equal(recipes[0]?.id, 'rc_2')
  })

  test('save() removes ingredient rows no longer present on the aggregate', async ({ assert }) => {
    await createUser('u_4', 'owner4@example.com')
    await createHousehold('h_4', 'u_4')

    const repository = new LucidRecipeRepository()
    await repository.save(buildRecipe('rc_4', 'h_4', 3))
    await repository.save(buildRecipe('rc_4', 'h_4', 1))

    const found = await repository.findById('rc_4')
    assert.lengthOf(found?.ingredients ?? [], 1)
  })

  test('delete() removes the recipe and cascades its ingredients', async ({ assert }) => {
    await createUser('u_5', 'owner5@example.com')
    await createHousehold('h_5', 'u_5')

    const repository = new LucidRecipeRepository()
    await repository.save(buildRecipe('rc_5', 'h_5'))
    await repository.delete('rc_5')

    assert.isNull(await repository.findById('rc_5'))
  })
})
