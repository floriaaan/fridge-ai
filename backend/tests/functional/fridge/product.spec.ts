import { test } from '@japa/runner'

async function signUpWithHousehold(client: import('@japa/api-client').ApiClient, email: string) {
  const signUp = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  const cookie = signUp.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer produits' })
  return cookie
}

test.group('fridge: product CRUD, expiring-soon, lookup, image', () => {
  test('create → show → update → delete', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'fridge-crud@example.com')

    const create = await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Lait',
        quantity: { amount: 1, unit: 'L' },
        location: 'fridge',
        category: 'Produits laitiers',
      })
    create.assertStatus(201)
    const productId = create.body().product.id

    const show = await client.get(`/api/products/${productId}`).headers({ cookie })
    show.assertBodyContains({ product: { name: 'Lait' } })

    const update = await client
      .patch(`/api/products/${productId}`)
      .headers({ cookie })
      .json({ name: 'Lait entier' })
    update.assertBodyContains({ product: { name: 'Lait entier' } })

    const destroy = await client.delete(`/api/products/${productId}`).headers({ cookie })
    destroy.assertStatus(204)

    const afterDelete = await client.get(`/api/products/${productId}`).headers({ cookie })
    afterDelete.assertStatus(404)
  })

  test('create rejects a non-integer quantity', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'fridge-validation@example.com')
    const response = await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Farine',
        quantity: { amount: 0.5, unit: 'kg' },
        location: 'pantry',
        category: 'Épicerie',
      })
    response.assertStatus(400)
  })

  test('expiring-soon only returns products within the window', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'fridge-expiring@example.com')

    const soon = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
    const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Yaourt',
        quantity: { amount: 1, unit: 'piece' },
        location: 'fridge',
        category: 'Laitier',
        expiresAt: soon,
      })
    await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Conserve',
        quantity: { amount: 1, unit: 'piece' },
        location: 'pantry',
        category: 'Épicerie',
        expiresAt: far,
      })

    const response = await client.get('/api/products/expiring-soon?days=3').headers({ cookie })
    response.assertStatus(200)
    assert.lengthOf(response.body().products, 1)
    assert.equal(response.body().products[0].name, 'Yaourt')
  })

  test('lookup returns the mapped result for a found barcode', async ({ client, cleanup }) => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          status: 1,
          product: { product_name: 'Nutella', categories_tags: ['en:spreads'] },
        }),
      )) as typeof fetch
    cleanup(() => {
      globalThis.fetch = originalFetch
    })

    const cookie = await signUpWithHousehold(client, 'fridge-lookup@example.com')
    const response = await client
      .get('/api/products/lookup?barcode=3017620422003')
      .headers({ cookie })
    response.assertStatus(200)
    response.assertBodyContains({ result: { name: 'Nutella', openfoodfactId: '3017620422003' } })
  })

  test('image returns 404 when the product has no imageKey', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'fridge-image@example.com')
    const create = await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Beurre',
        quantity: { amount: 1, unit: 'piece' },
        location: 'fridge',
        category: 'Laitier',
      })
    const productId = create.body().product.id

    const response = await client.get(`/api/products/${productId}/image`).headers({ cookie })
    response.assertStatus(404)
  })

  test('all product routes require a household', async ({ client }) => {
    const signUp = await client.post('/api/auth/sign-up/email').json({
      email: 'fridge-no-household@example.com',
      password: 'correct-horse-battery-staple',
      name: 'Test',
    })
    const cookie = signUp.headers()['set-cookie']
    if (!cookie) throw new Error('set-cookie header missing')

    const response = await client.get('/api/products').headers({ cookie })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'no_household' } })
  })
})
