import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { __setRecipeGenerationOverrideForTests } from '#infrastructure/settings/ai-provider-registry'
import type { RecipeGenerationPort } from '#domain/recipe/interfaces/recipe-generation-port.interface'

const fakeDrafts = [
  {
    title: 'Gratin de courgettes',
    description: null,
    instructions: 'Couper, cuire, gratiner.',
    preparationTime: 30,
    tags: ['végétarien'],
    ingredients: [{ label: 'Courgette', productId: null, quantity: 2, unit: 'piece' }],
  },
]

const fakeGeneration: RecipeGenerationPort = {
  async generate() {
    return fakeDrafts
  },
}

async function signUpWithHousehold(client: import('@japa/api-client').ApiClient, email: string) {
  const signUp = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  const cookie = signUp.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer recettes' })
  return cookie
}

test.group('recipe: generate, suggestions, save, list, detail, delete', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  group.each.setup(() => {
    __setRecipeGenerationOverrideForTests(fakeGeneration)
    return () => __setRecipeGenerationOverrideForTests(null)
  })

  test('generate persists the fake drafts', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'recipe-generate@example.com')
    const response = await client
      .post('/api/recipes/generate')
      .headers({ cookie })
      .json({ prompt: 'quelque chose de rapide' })
    response.assertStatus(201)
    assert.lengthOf(response.body().recipes, 1)
    response.assertBodyContains({ recipes: [{ title: 'Gratin de courgettes', source: 'ai' }] })

    const list = await client.get('/api/recipes').headers({ cookie })
    assert.lengthOf(list.body().recipes, 1)
  })

  test('suggestions does not persist', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'recipe-suggestions@example.com')
    const response = await client.get('/api/recipes/suggestions').headers({ cookie })
    response.assertStatus(200)
    assert.lengthOf(response.body().recipes, 1)

    const list = await client.get('/api/recipes').headers({ cookie })
    assert.lengthOf(list.body().recipes, 0)
  })

  test('save persists a manual recipe, detail and delete work', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'recipe-save@example.com')

    const save = await client
      .post('/api/recipes')
      .headers({ cookie })
      .json({
        title: 'Salade de tomates',
        source: 'user',
        instructions: 'Couper, assaisonner.',
        ingredients: [{ label: 'Tomate', quantity: 3, unit: 'piece' }],
      })
    save.assertStatus(201)
    const recipeId = save.body().recipe.id

    const detail = await client.get(`/api/recipes/${recipeId}`).headers({ cookie })
    detail.assertBodyContains({ recipe: { title: 'Salade de tomates', source: 'user' } })
    assert.lengthOf(detail.body().recipe.ingredients, 1)

    const destroy = await client.delete(`/api/recipes/${recipeId}`).headers({ cookie })
    destroy.assertStatus(204)

    const afterDelete = await client.get(`/api/recipes/${recipeId}`).headers({ cookie })
    afterDelete.assertStatus(404)
  })

  test('save rejects an unknown source', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'recipe-badsource@example.com')
    const response = await client
      .post('/api/recipes')
      .headers({ cookie })
      .json({
        title: 'X',
        source: 'community',
        instructions: 'X',
        ingredients: [{ label: 'X' }],
      })
    response.assertStatus(422)
  })

  test('all recipe routes require a household', async ({ client }) => {
    const signUp = await client.post('/api/auth/sign-up/email').json({
      email: 'recipe-no-household@example.com',
      password: 'correct-horse-battery-staple',
      name: 'Test',
    })
    const cookie = signUp.headers()['set-cookie']
    if (!cookie) throw new Error('set-cookie header missing')

    const response = await client.get('/api/recipes').headers({ cookie })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'no_household' } })
  })
})
