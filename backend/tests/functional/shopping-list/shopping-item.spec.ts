import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

async function signUpWithHousehold(client: import('@japa/api-client').ApiClient, email: string) {
  const signUp = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  const cookie = signUp.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer courses' })
  return cookie
}

test.group('shopping-list: CRUD', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('create → list → update (toggle) → delete', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'shopping-crud@example.com')

    const create = await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({ name: 'Farine', quantity: { amount: 1, unit: 'kg' }, source: 'manual' })
    create.assertStatus(201)
    const itemId = create.body().item.id

    const list = await client.get('/api/shopping-items').headers({ cookie })
    list.assertStatus(200)
    list.assertBodyContains({ items: [{ name: 'Farine', checked: false }] })

    const toggle = await client
      .patch(`/api/shopping-items/${itemId}`)
      .headers({ cookie })
      .json({ checked: true })
    toggle.assertBodyContains({ item: { checked: true } })

    const destroy = await client.delete(`/api/shopping-items/${itemId}`).headers({ cookie })
    destroy.assertStatus(204)

    const afterDelete = await client.get('/api/shopping-items').headers({ cookie })
    afterDelete.assertBodyContains({ items: [] })
  })

  test('create rejects a non-integer quantity', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'shopping-validation@example.com')
    const response = await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({ name: 'Lait', quantity: { amount: 0.5, unit: 'L' }, source: 'manual' })
    response.assertStatus(400)
  })

  test('create rejects an unknown source', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'shopping-badsource@example.com')
    const response = await client
      .post('/api/shopping-items')
      .headers({ cookie })
      .json({ name: 'Lait', quantity: { amount: 1, unit: 'L' }, source: 'not-a-source' })
    response.assertStatus(422)
  })

  test('update on an unknown item returns 404', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'shopping-404@example.com')
    const response = await client
      .patch('/api/shopping-items/does-not-exist')
      .headers({ cookie })
      .json({ checked: true })
    response.assertStatus(404)
    response.assertBodyContains({ error: { type: 'shopping_item_not_found' } })
  })

  test('accessing another household item returns 404, not a leak', async ({ client }) => {
    const cookieA = await signUpWithHousehold(client, 'shopping-household-a@example.com')
    const create = await client
      .post('/api/shopping-items')
      .headers({ cookie: cookieA })
      .json({ name: 'Farine', quantity: { amount: 1, unit: 'kg' }, source: 'manual' })
    create.assertStatus(201)
    const itemId = create.body().item.id

    const cookieB = await signUpWithHousehold(client, 'shopping-household-b@example.com')

    const patch = await client
      .patch(`/api/shopping-items/${itemId}`)
      .headers({ cookie: cookieB })
      .json({ checked: true })
    patch.assertStatus(404)
    patch.assertBodyContains({ error: { type: 'shopping_item_not_found' } })

    const destroy = await client
      .delete(`/api/shopping-items/${itemId}`)
      .headers({ cookie: cookieB })
    destroy.assertStatus(404)
    destroy.assertBodyContains({ error: { type: 'shopping_item_not_found' } })
  })

  test('all shopping-item routes require a household', async ({ client }) => {
    const signUp = await client.post('/api/auth/sign-up/email').json({
      email: 'shopping-no-household@example.com',
      password: 'correct-horse-battery-staple',
      name: 'Test',
    })
    const cookie = signUp.headers()['set-cookie']
    if (!cookie) throw new Error('set-cookie header missing')

    const response = await client.get('/api/shopping-items').headers({ cookie })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'no_household' } })
  })
})
