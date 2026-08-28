# Mobile Fridge Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile fridge inventory sub-project — list/detail/CRUD of `product`s, barcode lookup via a dedicated scanner screen, and a new `fridge` tab — wired to the backend's already-shipped `/api/products*` endpoints.

**Architecture:** Same layered structure as every prior mobile phase: `domain/fridge` (plain types + a `Quantity` validation VO) → `application/fridge` (TanStack Query hooks over the `FridgeConnector` abstraction) → `infrastructure/{http,fake}` (the two `FridgeConnector` implementations) → `presentation/fridge` (screens) → `app/(tabs)/fridge/*` (expo-router routes). One list of tasks, in dependency order; each task's tests pass before moving to the next.

**Tech Stack:** Expo Router (typed routes), TanStack Query, Tamagui (`YStack`/`XStack`/`Text`/`Input`/`Button`), `expo-camera` (new dependency, barcode scanning), `jest-expo` + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-08-28-mobile-fridge-design.md`

## Global Constraints

- Every backend-facing method returns `Promise<Result<T, ApiError>>` for mutating calls, or a plain (possibly empty) value for reads — exactly the existing `FridgeConnector` convention (`getShoppingItems(): Promise<ShoppingItem[]>` vs `toggleShoppingItem(): Promise<Result<ShoppingItem, ApiError>>`). Never throw for an expected backend error.
- `Product`/`CreateProductInput`/`UpdateProductInput` field names are structurally identical to the backend's `ProductDto`/`createProductValidator`/`updateProductValidator` (`backend/src/presentation/fridge/product.dto.ts`, `product.validator.ts`) — no re-mapping.
- No image upload in this phase — `imageKey`/`GET /products/:id/image` are not consumed. Only `imageUrl` from a barcode lookup result is displayed, read-only.
- All new mobile files use the `.js` extension in relative imports (ESM interop, matches every existing mobile source file) even though the files on disk are `.ts`/`.tsx`.
- New user-facing strings are French, matching every other mobile screen.

---

## Task 1: Domain layer — `Product`, `Quantity` VO, `ValidationError`, `ProductLookupResult`

**Files:**
- Create: `mobile/src/domain/shared/validation-error.ts`
- Create: `mobile/src/domain/fridge/location.ts`
- Create: `mobile/src/domain/fridge/quantity.ts`
- Create: `mobile/src/domain/fridge/quantity.test.ts`
- Create: `mobile/src/domain/fridge/product.ts`
- Create: `mobile/src/domain/fridge/product-lookup-result.ts`

**Interfaces:**
- Produces: `ValidationError { field: string; message: string }`; `LocationValue = 'fridge' | 'freezer' | 'pantry'`; `LOCATIONS: readonly LocationValue[]`; `Quantity.create(amount: number, unit: string): Result<{ amount: number; unit: string }, ValidationError>`; `Product`, `CreateProductInput`, `UpdateProductInput` (see below); `ProductLookupResult { name: string; category: string | null; categories: string[] | null; imageUrl: string | null; openfoodfactId: string }`.

- [ ] **Step 1: Write the failing test for `Quantity`**

```ts
// mobile/src/domain/fridge/quantity.test.ts
import { Quantity } from './quantity.js'

test('create() accepts a positive integer amount with a non-empty unit', () => {
  const result = Quantity.create(2, 'L')
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value).toEqual({ amount: 2, unit: 'L' })
})

test('create() trims the unit', () => {
  const result = Quantity.create(1, '  kg  ')
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.unit).toBe('kg')
})

test('create() rejects a non-integer amount', () => {
  const result = Quantity.create(1.5, 'kg')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error.field).toBe('quantity')
})

test('create() rejects an amount of 0 or less', () => {
  expect(Quantity.create(0, 'kg').ok).toBe(false)
  expect(Quantity.create(-1, 'kg').ok).toBe(false)
})

test('create() rejects an empty unit', () => {
  const result = Quantity.create(1, '   ')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error.field).toBe('quantity')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && pnpm test -- src/domain/fridge/quantity.test.ts`
Expected: FAIL — `Cannot find module './quantity.js'`

- [ ] **Step 3: Write the domain types and the `Quantity` VO**

```ts
// mobile/src/domain/shared/validation-error.ts
export interface ValidationError {
  field: string
  message: string
}
```

```ts
// mobile/src/domain/fridge/location.ts
export type LocationValue = 'fridge' | 'freezer' | 'pantry'

export const LOCATIONS: readonly LocationValue[] = ['fridge', 'freezer', 'pantry']
```

```ts
// mobile/src/domain/fridge/quantity.ts
import { Result } from '../shared/result.js'
import type { ValidationError } from '../shared/validation-error.js'

export interface QuantityValue {
  amount: number
  unit: string
}

/**
 * Client-side mirror of the backend's `Quantity` VO (`backend/src/domain/
 * fridge/quantity.vo.ts`) — same two rules, so the form can reject an
 * invalid quantity before a round trip instead of only after one.
 */
export const Quantity = {
  create(amount: number, unit: string): Result<QuantityValue, ValidationError> {
    if (!Number.isInteger(amount) || amount <= 0) {
      return Result.err({ field: 'quantity', message: 'La quantité doit être un entier supérieur à 0.' })
    }
    const trimmedUnit = unit.trim()
    if (trimmedUnit.length === 0) {
      return Result.err({ field: 'quantity', message: "L'unité est requise." })
    }
    return Result.ok({ amount, unit: trimmedUnit })
  },
}
```

```ts
// mobile/src/domain/fridge/product.ts
import type { LocationValue } from './location.js'

/** Structurally identical to the backend's `ProductDto` (`product.dto.ts`) — no re-mapping on this side. */
export interface Product {
  id: string
  name: string
  quantity: { amount: number; unit: string }
  location: LocationValue
  expiresAt: string | null
  openedAt: string | null
  category: string
  categories: string[] | null
  openfoodfactId: string | null
  receiptId: string | null
  price: number | null
  imageKey: string | null
  createdAt: string
  updatedAt: string
}

/** Mirrors `createProductValidator` (`product.validator.ts`) field-for-field. */
export interface CreateProductInput {
  name: string
  quantity: { amount: number; unit: string }
  location: LocationValue
  category: string
  expiresAt?: string | null
  openedAt?: string | null
  openfoodfactId?: string | null
  categories?: string[] | null
  price?: number | null
}

/** Mirrors `updateProductValidator` — every field optional, `null` allowed where the backend allows clearing it. */
export interface UpdateProductInput {
  name?: string
  quantity?: { amount: number; unit: string }
  location?: LocationValue
  category?: string
  expiresAt?: string | null
  openedAt?: string | null
  openfoodfactId?: string | null
  categories?: string[] | null
  price?: number | null
}
```

```ts
// mobile/src/domain/fridge/product-lookup-result.ts
/** Structurally identical to the backend's `ProductLookupResult` (`product-lookup-port.interface.ts`). */
export interface ProductLookupResult {
  name: string
  category: string | null
  categories: string[] | null
  imageUrl: string | null
  openfoodfactId: string
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && pnpm test -- src/domain/fridge/quantity.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck and commit**

Run: `cd mobile && pnpm typecheck`
Expected: no errors

```bash
git add mobile/src/domain/shared/validation-error.ts mobile/src/domain/fridge/
git commit -m "feat(mobile): fridge domain types (Product, Quantity VO, ProductLookupResult)"
```

---

## Task 2: `apiFetch` — handle a 204 No Content response

**Files:**
- Modify: `mobile/src/infrastructure/http/http-client.ts`
- Create: `mobile/src/infrastructure/http/http-client.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `apiFetch<T>(path, init?): Promise<Result<T, ApiError>>` — unchanged signature, now resolves `Result.ok(undefined as T)` on any 204 response instead of throwing on the empty body.

Every existing `FridgeConnector` method that hits `apiFetch` returns JSON. `DeleteProduct` (Task 3) is the first mobile call whose backend route (`DELETE /api/products/:id`) responds `204` with an empty body — `apiFetch` currently calls `response.json()` unconditionally, which throws on an empty body and gets swallowed by the `catch` into a misleading `network_error`. Fixed once here, ahead of being relied on.

- [ ] **Step 1: Write the failing test**

```ts
// mobile/src/infrastructure/http/http-client.test.ts
import { apiFetch } from './http-client.js'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

test('apiFetch() resolves Result.ok(undefined) on a 204 response without parsing a body', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    status: 204,
    ok: true,
    json: () => Promise.reject(new Error('should not be called on 204')),
  }) as unknown as typeof fetch

  const result = await apiFetch<void>('/api/products/some-id', { method: 'DELETE' })

  expect(result).toEqual({ ok: true, value: undefined })
})

test('apiFetch() still parses JSON on a normal 200 response', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ hello: 'world' }),
  }) as unknown as typeof fetch

  const result = await apiFetch<{ hello: string }>('/api/whatever')

  expect(result).toEqual({ ok: true, value: { hello: 'world' } })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && pnpm test -- src/infrastructure/http/http-client.test.ts`
Expected: FAIL on the first test — `json` rejects, caught into `{ ok: false, error: { type: 'network_error', ... } }`, not the expected `{ ok: true, value: undefined }`.

- [ ] **Step 3: Handle the 204 case**

```ts
// mobile/src/infrastructure/http/http-client.ts
import { Result } from '../../domain/shared/result.js'
import type { ApiError } from '../../domain/shared/api-error.js'

const API_URL = process.env.EXPO_PUBLIC_API_URL as string

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<Result<T, ApiError>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
    // A 204 always means "success, no body" — nothing to parse.
    if (response.status === 204) return Result.ok(undefined as T)
    const body = await response.json()
    if (!response.ok) return Result.err(body.error as ApiError)
    return Result.ok(body as T)
  } catch {
    return Result.err({ type: 'network_error', message: 'Impossible de contacter le serveur.' })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && pnpm test -- src/infrastructure/http/http-client.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/infrastructure/http/http-client.ts mobile/src/infrastructure/http/http-client.test.ts
git commit -m "fix(mobile): apiFetch() handles 204 No Content without parsing a body"
```

---

## Task 3: `FridgeConnector` — extend with the `fridge` method group

**Files:**
- Modify: `mobile/src/domain/interfaces/fridge-connector.ts`
- Modify: `mobile/src/infrastructure/http/http-fridge-connector.ts`
- Modify: `mobile/src/infrastructure/http/http-fridge-connector.test.ts`
- Modify: `mobile/src/infrastructure/fake/fake-fridge-connector.ts`
- Modify: `mobile/src/infrastructure/fake/fake-fridge-connector.test.ts`
- Create: `mobile/src/infrastructure/fake/fixtures/product.fixture.ts`
- Create: `mobile/src/infrastructure/fake/fixtures/product-lookup.fixture.ts`

**Interfaces:**
- Consumes: `Product`, `CreateProductInput`, `UpdateProductInput`, `LocationValue` (Task 1, `domain/fridge/product.js`, `domain/fridge/location.js`), `ProductLookupResult` (Task 1), `Result`, `ApiError`, `apiFetch` (Task 2).
- Produces: `FridgeConnector` gains `getProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct`, `getExpiringSoonProducts`, `lookupProductByBarcode` — exact signatures below. `fakeProducts: Product[]` and `fakeProductLookup: Record<string, ProductLookupResult>` fixtures, consumed by Task 5's screen tests too.

- [ ] **Step 1: Extend the `FridgeConnector` interface**

```ts
// mobile/src/domain/interfaces/fridge-connector.ts
import type { Result } from '../shared/result.js'
import type { ApiError } from '../shared/api-error.js'
import type { Session } from '../identity/session.js'
import type { AuthMethod } from '../identity/auth-method.js'
import type { ShoppingItem } from '../shopping-list/shopping-item.js'
import type { Recipe } from '../recipe/recipe.js'
import type { Product, CreateProductInput, UpdateProductInput } from '../fridge/product.js'
import type { LocationValue } from '../fridge/location.js'
import type { ProductLookupResult } from '../fridge/product-lookup-result.js'

/**
 * The app's one abstraction boundary over the backend. Extended by one
 * method group per bounded context, one phase at a time — never a
 * placeholder method for a context this phase doesn't build.
 */
export interface FridgeConnector {
  getSession(): Promise<Session | null>
  getAuthMethods(): Promise<AuthMethod[]>
  signInEmail(email: string, password: string): Promise<Result<Session, ApiError>>
  signUpEmail(email: string, password: string, name: string): Promise<Result<Session, ApiError>>
  signInSocial(provider: 'pocketid'): Promise<Result<Session, ApiError>>
  signOut(): Promise<void>
  getShoppingItems(): Promise<ShoppingItem[]>
  toggleShoppingItem(itemId: string, checked: boolean): Promise<Result<ShoppingItem, ApiError>>
  getRecipes(): Promise<Recipe[]>
  getProducts(params?: { location?: LocationValue; expiringWithinDays?: number }): Promise<Product[]>
  getProduct(productId: string): Promise<Product | null>
  createProduct(input: CreateProductInput): Promise<Result<Product, ApiError>>
  updateProduct(productId: string, patch: UpdateProductInput): Promise<Result<Product, ApiError>>
  deleteProduct(productId: string): Promise<Result<void, ApiError>>
  getExpiringSoonProducts(days?: number): Promise<Product[]>
  lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null>
}
```

- [ ] **Step 2: Write the failing `HttpFridgeConnector` tests**

Append to the existing file:

```ts
// mobile/src/infrastructure/http/http-fridge-connector.test.ts — append
test('getProducts() returns [] when the request fails', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    status: 500,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'server_error', message: 'oops' } }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  expect(await connector.getProducts()).toEqual([])

  global.fetch = originalFetch
})

test('getProducts() builds the query string from location/expiringWithinDays', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ products: [] }),
  })
  global.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  await connector.getProducts({ location: 'freezer', expiringWithinDays: 5 })

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/api/products?location=freezer&expiringWithinDays=5'),
    expect.anything(),
  )

  global.fetch = originalFetch
})

test('deleteProduct() maps a 204 response to Result.ok(undefined)', async () => {
  global.fetch = jest.fn().mockResolvedValue({ status: 204, ok: true }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.deleteProduct('some-id')

  expect(result).toEqual({ ok: true, value: undefined })

  global.fetch = originalFetch
})

test('lookupProductByBarcode() returns null when the backend finds nothing', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ result: null }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  expect(await connector.lookupProductByBarcode('0000000000000')).toBeNull()

  global.fetch = originalFetch
})
```

Add one line to the existing top-of-file setup, right after `const signInEmailMock = ...`:

```ts
// mobile/src/infrastructure/http/http-fridge-connector.test.ts — insert after `const signInEmailMock = authClient.signIn.email as jest.Mock`
const originalFetch = global.fetch
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd mobile && pnpm test -- src/infrastructure/http/http-fridge-connector.test.ts`
Expected: FAIL — `connector.getProducts is not a function`

- [ ] **Step 4: Implement the methods on `HttpFridgeConnector`**

```ts
// mobile/src/infrastructure/http/http-fridge-connector.ts — add imports
import type { Product, CreateProductInput, UpdateProductInput } from '../../domain/fridge/product.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { ProductLookupResult } from '../../domain/fridge/product-lookup-result.js'
```

```ts
// mobile/src/infrastructure/http/http-fridge-connector.ts — add to the class
async getProducts(params?: { location?: LocationValue; expiringWithinDays?: number }): Promise<Product[]> {
  const query = new URLSearchParams()
  if (params?.location) query.set('location', params.location)
  if (params?.expiringWithinDays) query.set('expiringWithinDays', String(params.expiringWithinDays))
  const qs = query.toString()
  const result = await apiFetch<{ products: Product[] }>(`/api/products${qs ? `?${qs}` : ''}`)
  return result.ok ? result.value.products : []
}

async getProduct(productId: string): Promise<Product | null> {
  const result = await apiFetch<{ product: Product }>(`/api/products/${productId}`)
  return result.ok ? result.value.product : null
}

async createProduct(input: CreateProductInput): Promise<Result<Product, ApiError>> {
  const result = await apiFetch<{ product: Product }>('/api/products', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return result.ok ? Result.ok(result.value.product) : Result.err(result.error)
}

async updateProduct(productId: string, patch: UpdateProductInput): Promise<Result<Product, ApiError>> {
  const result = await apiFetch<{ product: Product }>(`/api/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return result.ok ? Result.ok(result.value.product) : Result.err(result.error)
}

async deleteProduct(productId: string): Promise<Result<void, ApiError>> {
  const result = await apiFetch<void>(`/api/products/${productId}`, { method: 'DELETE' })
  return result.ok ? Result.ok(undefined) : Result.err(result.error)
}

async getExpiringSoonProducts(days?: number): Promise<Product[]> {
  const qs = days ? `?days=${days}` : ''
  const result = await apiFetch<{ products: Product[] }>(`/api/products/expiring-soon${qs}`)
  return result.ok ? result.value.products : []
}

async lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null> {
  const result = await apiFetch<{ result: ProductLookupResult | null }>(
    `/api/products/lookup?barcode=${encodeURIComponent(barcode)}`,
  )
  return result.ok ? result.value.result : null
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd mobile && pnpm test -- src/infrastructure/http/http-fridge-connector.test.ts`
Expected: PASS (all tests, existing + new)

- [ ] **Step 6: Write fixtures**

```ts
// mobile/src/infrastructure/fake/fixtures/product.fixture.ts
import type { Product } from '../../../domain/fridge/product.js'

export const fakeProducts: Product[] = [
  {
    id: 'fake-product-1',
    name: 'Lait demi-écrémé',
    quantity: { amount: 1, unit: 'L' },
    location: 'fridge',
    expiresAt: '2026-08-30T00:00:00.000Z',
    openedAt: null,
    category: 'Produits laitiers',
    categories: ['lait'],
    openfoodfactId: null,
    receiptId: null,
    price: 1.2,
    imageKey: null,
    createdAt: '2026-08-25T08:00:00.000Z',
    updatedAt: '2026-08-25T08:00:00.000Z',
  },
  {
    id: 'fake-product-2',
    name: 'Épinards surgelés',
    quantity: { amount: 1, unit: 'kg' },
    location: 'freezer',
    expiresAt: '2027-02-01T00:00:00.000Z',
    openedAt: null,
    category: 'Légumes',
    categories: ['légumes', 'surgelés'],
    openfoodfactId: null,
    receiptId: null,
    price: 2.5,
    imageKey: null,
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
  },
  {
    id: 'fake-product-3',
    name: 'Riz basmati',
    quantity: { amount: 1, unit: 'kg' },
    location: 'pantry',
    expiresAt: null,
    openedAt: null,
    category: 'Féculents',
    categories: null,
    openfoodfactId: null,
    receiptId: null,
    price: 3.0,
    imageKey: null,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
]
```

```ts
// mobile/src/infrastructure/fake/fixtures/product-lookup.fixture.ts
import type { ProductLookupResult } from '../../../domain/fridge/product-lookup-result.js'

/** Keyed by barcode — `FakeFridgeConnector.lookupProductByBarcode()` looks up this map, `null` for anything else. */
export const fakeProductLookup: Record<string, ProductLookupResult> = {
  '3017620422003': {
    name: 'Pâte à tartiner noisettes-cacao',
    category: 'Pâtes à tartiner',
    categories: ['petit-déjeuner', 'sucré'],
    imageUrl: null,
    openfoodfactId: '3017620422003',
  },
}
```

- [ ] **Step 7: Write the failing `FakeFridgeConnector` tests**

Append to the existing file:

```ts
// mobile/src/infrastructure/fake/fake-fridge-connector.test.ts — append
test('getProducts() returns the fixture list', async () => {
  const connector = new FakeFridgeConnector()
  const products = await connector.getProducts()
  expect(products.length).toBeGreaterThan(0)
})

test('getProducts() filters by location', async () => {
  const connector = new FakeFridgeConnector()
  const products = await connector.getProducts({ location: 'freezer' })
  expect(products.every((p) => p.location === 'freezer')).toBe(true)
  expect(products.length).toBeGreaterThan(0)
})

test('createProduct() adds a product retrievable via getProduct()', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.createProduct({
    name: 'Yaourts nature',
    quantity: { amount: 8, unit: 'unités' },
    location: 'fridge',
    category: 'Produits laitiers',
  })
  expect(result.ok).toBe(true)
  if (!result.ok) return

  const fetched = await connector.getProduct(result.value.id)
  expect(fetched?.name).toBe('Yaourts nature')
})

test('updateProduct() patches an existing product', async () => {
  const connector = new FakeFridgeConnector()
  const [first] = await connector.getProducts()

  const result = await connector.updateProduct(first.id, { name: 'Lait entier' })
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.name).toBe('Lait entier')
})

test('updateProduct() rejects an unknown id', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.updateProduct('does-not-exist', { name: 'x' })
  expect(result.ok).toBe(false)
})

test('deleteProduct() removes the product', async () => {
  const connector = new FakeFridgeConnector()
  const [first] = await connector.getProducts()

  const result = await connector.deleteProduct(first.id)
  expect(result.ok).toBe(true)
  expect(await connector.getProduct(first.id)).toBeNull()
})

test('lookupProductByBarcode() returns the fixture result for a known barcode', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.lookupProductByBarcode('3017620422003')
  expect(result?.name).toBe('Pâte à tartiner noisettes-cacao')
})

test('lookupProductByBarcode() returns null for an unknown barcode', async () => {
  const connector = new FakeFridgeConnector()
  expect(await connector.lookupProductByBarcode('0000000000000')).toBeNull()
})
```

- [ ] **Step 8: Run it to verify it fails**

Run: `cd mobile && pnpm test -- src/infrastructure/fake/fake-fridge-connector.test.ts`
Expected: FAIL — `connector.getProducts is not a function`

- [ ] **Step 9: Implement the methods on `FakeFridgeConnector`**

```ts
// mobile/src/infrastructure/fake/fake-fridge-connector.ts — add imports
import { fakeProducts } from './fixtures/product.fixture.js'
import { fakeProductLookup } from './fixtures/product-lookup.fixture.js'
import type { Product, CreateProductInput, UpdateProductInput } from '../../domain/fridge/product.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { ProductLookupResult } from '../../domain/fridge/product-lookup-result.js'
```

```ts
// mobile/src/infrastructure/fake/fake-fridge-connector.ts — new private field, alongside `shoppingItems`
private products: Product[] = fakeProducts.map((p) => ({ ...p }))
private nextProductId = 1
```

```ts
// mobile/src/infrastructure/fake/fake-fridge-connector.ts — add to the class
async getProducts(params?: { location?: LocationValue; expiringWithinDays?: number }): Promise<Product[]> {
  let result = this.products
  if (params?.location) result = result.filter((p) => p.location === params.location)
  if (params?.expiringWithinDays) {
    const threshold = Date.now() + params.expiringWithinDays * 24 * 60 * 60 * 1000
    result = result.filter((p) => p.expiresAt !== null && new Date(p.expiresAt).getTime() <= threshold)
  }
  return result
}

async getProduct(productId: string): Promise<Product | null> {
  return this.products.find((p) => p.id === productId) ?? null
}

async createProduct(input: CreateProductInput): Promise<Result<Product, ApiError>> {
  const now = new Date().toISOString()
  const product: Product = {
    id: `fake-product-new-${this.nextProductId++}`,
    name: input.name,
    quantity: input.quantity,
    location: input.location,
    category: input.category,
    expiresAt: input.expiresAt ?? null,
    openedAt: input.openedAt ?? null,
    openfoodfactId: input.openfoodfactId ?? null,
    categories: input.categories ?? null,
    receiptId: null,
    price: input.price ?? null,
    imageKey: null,
    createdAt: now,
    updatedAt: now,
  }
  this.products.push(product)
  return Result.ok(product)
}

async updateProduct(productId: string, patch: UpdateProductInput): Promise<Result<Product, ApiError>> {
  const product = this.products.find((p) => p.id === productId)
  if (!product) return Result.err({ type: 'product_not_found', message: 'Produit introuvable.' })
  Object.assign(product, patch, { updatedAt: new Date().toISOString() })
  return Result.ok(product)
}

async deleteProduct(productId: string): Promise<Result<void, ApiError>> {
  const index = this.products.findIndex((p) => p.id === productId)
  if (index === -1) return Result.err({ type: 'product_not_found', message: 'Produit introuvable.' })
  this.products.splice(index, 1)
  return Result.ok(undefined)
}

async getExpiringSoonProducts(days = 3): Promise<Product[]> {
  return this.getProducts({ expiringWithinDays: days })
}

async lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null> {
  return fakeProductLookup[barcode] ?? null
}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `cd mobile && pnpm test -- src/infrastructure/fake/fake-fridge-connector.test.ts`
Expected: PASS (all tests, existing + new)

- [ ] **Step 11: Typecheck, run the full suite, and commit**

Run: `cd mobile && pnpm typecheck && pnpm test`
Expected: no type errors, all tests pass

```bash
git add mobile/src/domain/interfaces/fridge-connector.ts mobile/src/infrastructure/http/ mobile/src/infrastructure/fake/
git commit -m "feat(mobile): extend FridgeConnector with fridge product ops"
```

---

## Task 4: `expo-camera` dependency + permission config

**Files:**
- Modify: `mobile/package.json` (via `expo install`)
- Modify: `mobile/app.json`

**Interfaces:**
- Produces: `expo-camera`'s `CameraView`, `useCameraPermissions` importable from `'expo-camera'` — consumed by Task 9.

- [ ] **Step 1: Install the dependency**

Run: `cd mobile && npx expo install expo-camera`
Expected: `expo-camera` added to `package.json` `dependencies` at the SDK-57-compatible version `expo install` resolves.

- [ ] **Step 2: Add the plugin with permission strings to `app.json`**

```json
// mobile/app.json — inside "expo.plugins", alongside "expo-web-browser"
[
  "expo-camera",
  {
    "cameraPermission": "Fridge AI a besoin de la caméra pour scanner le code-barres d'un produit."
  }
]
```

- [ ] **Step 3: Verify the app still boots**

Run: `cd mobile && npx expo-doctor`
Expected: no new warnings introduced by the plugin addition (existing warnings, if any, are unrelated and pre-date this task)

- [ ] **Step 4: Commit**

```bash
git add mobile/package.json mobile/pnpm-lock.yaml mobile/app.json
git commit -m "chore(mobile): add expo-camera for barcode scanning"
```

---

## Task 5: Application layer — fridge queries and mutations

**Files:**
- Create: `mobile/src/application/fridge/products.query.ts`
- Create: `mobile/src/application/fridge/products.query.test.tsx`
- Create: `mobile/src/application/fridge/product.query.ts`
- Create: `mobile/src/application/fridge/product-lookup.query.ts`
- Create: `mobile/src/application/fridge/create-product.mutation.ts`
- Create: `mobile/src/application/fridge/update-product.mutation.ts`
- Create: `mobile/src/application/fridge/delete-product.mutation.ts`

**Interfaces:**
- Consumes: `useDomainQuery` (`application/shared/use-domain-query.js`), `defineMutation` (`application/shared/define-mutation.js`), `FridgeConnector` methods from Task 3, `Product`/`CreateProductInput`/`UpdateProductInput`/`LocationValue` (Task 1).
- Produces: `useProductsQuery(params?)`, `useProductQuery(productId)`, `useProductLookupQuery(barcode)` (query hooks); `useCreateProductMutation`, `useUpdateProductMutation`, `useDeleteProductMutation` (mutation hooks) — consumed by Tasks 6–9's screens.

`products.query`/`product.query`/`product-lookup.query` take a runtime argument (filter params, an id, a barcode), which `defineQuery`'s fixed-`queryKey`-at-definition-time signature doesn't support (see `application/recipe/recipes.query.ts` and `application/shopping-list/shopping-items.query.ts` — neither takes params). They call `useDomainQuery` directly instead, same as `defineQuery` does internally.

- [ ] **Step 1: Write the failing test for `useProductsQuery`**

```tsx
// mobile/src/application/fridge/products.query.test.tsx
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { useProductsQuery } from './products.query.js'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  return (
    <QueryClientProvider client={queryClient}>
      <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
    </QueryClientProvider>
  )
}

test('useProductsQuery() resolves with the fixture products', async () => {
  const { result } = renderHook(() => useProductsQuery(), { wrapper })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.length).toBeGreaterThan(0)
})

test('useProductsQuery({ location }) resolves with only that location', async () => {
  const { result } = renderHook(() => useProductsQuery({ location: 'pantry' }), { wrapper })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.every((p) => p.location === 'pantry')).toBe(true)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && pnpm test -- src/application/fridge/products.query.test.tsx`
Expected: FAIL — `Cannot find module './products.query.js'`

- [ ] **Step 3: Implement the query and mutation hooks**

```ts
// mobile/src/application/fridge/products.query.ts
import { useDomainQuery } from '../shared/use-domain-query.js'
import type { LocationValue } from '../../domain/fridge/location.js'

export function useProductsQuery(params?: { location?: LocationValue; expiringWithinDays?: number }) {
  return useDomainQuery(['products', params ?? {}], (connector) => connector.getProducts(params))
}
```

```ts
// mobile/src/application/fridge/product.query.ts
import { useDomainQuery } from '../shared/use-domain-query.js'

export function useProductQuery(productId: string) {
  return useDomainQuery(['product', productId], (connector) => connector.getProduct(productId), {
    enabled: productId.length > 0,
  })
}
```

```ts
// mobile/src/application/fridge/product-lookup.query.ts
import { useDomainQuery } from '../shared/use-domain-query.js'

/** Not fetched on mount — the scanner/form calls `.refetch()` once a barcode is captured. */
export function useProductLookupQuery(barcode: string) {
  return useDomainQuery(['product-lookup', barcode], (connector) => connector.lookupProductByBarcode(barcode), {
    enabled: false,
  })
}
```

```ts
// mobile/src/application/fridge/create-product.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'
import type { CreateProductInput } from '../../domain/fridge/product.js'

export const useCreateProductMutation = defineMutation((connector, input: CreateProductInput) =>
  connector.createProduct(input),
)
```

```ts
// mobile/src/application/fridge/update-product.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'
import type { UpdateProductInput } from '../../domain/fridge/product.js'

export const useUpdateProductMutation = defineMutation(
  (connector, variables: { productId: string; patch: UpdateProductInput }) =>
    connector.updateProduct(variables.productId, variables.patch),
)
```

```ts
// mobile/src/application/fridge/delete-product.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'

export const useDeleteProductMutation = defineMutation((connector, productId: string) =>
  connector.deleteProduct(productId),
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && pnpm test -- src/application/fridge/products.query.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Typecheck and commit**

Run: `cd mobile && pnpm typecheck`
Expected: no errors

```bash
git add mobile/src/application/fridge/
git commit -m "feat(mobile): TanStack queries/mutations for fridge products"
```

---

## Task 6: `fridge-list-screen` + `fridge` tab route

**Files:**
- Create: `mobile/src/presentation/fridge/fridge-list-screen.tsx`
- Create: `mobile/src/presentation/fridge/fridge-list-screen.test.tsx`
- Create: `mobile/src/app/(tabs)/fridge/_layout.tsx`
- Create: `mobile/src/app/(tabs)/fridge/index.tsx`
- Modify: `mobile/src/app/(tabs)/_layout.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx`
- Modify: `mobile/src/presentation/dashboard/household-dashboard.tsx`

**Interfaces:**
- Consumes: `useProductsQuery` (Task 5), `Product`/`LOCATIONS`/`LocationValue` (Task 1), `Sidebar` (`presentation/shared/sidebar.js`), `useHoverPress`/`pointerCursor` (`presentation/shared/hover.js`), `useSoftPalette` (`presentation/dashboard/soft-palette.js`).
- Produces: `FridgeListScreen` component (no props) — routed at `/(tabs)/fridge`, consumed as the "Voir tout" destination from the dashboard and as the back-target after create/edit/delete (Tasks 7–8).

- [ ] **Step 1: Write the failing screen test**

```tsx
// mobile/src/presentation/fridge/fridge-list-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { FridgeListScreen } from './fridge-list-screen.js'

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('renders every fixture product by name', async () => {
  await renderWithProviders(<FridgeListScreen />)

  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())
  expect(screen.getByText('Épinards surgelés')).toBeTruthy()
  expect(screen.getByText('Riz basmati')).toBeTruthy()
})

test('filtering by "freezer" hides products in other locations', async () => {
  await renderWithProviders(<FridgeListScreen />)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('fridge-filter-freezer'))

  await waitFor(() => expect(screen.queryByText('Lait demi-écrémé')).toBeNull())
  expect(screen.getByText('Épinards surgelés')).toBeTruthy()
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && pnpm test -- src/presentation/fridge/fridge-list-screen.test.tsx`
Expected: FAIL — `Cannot find module './fridge-list-screen.js'`

- [ ] **Step 3: Implement the screen**

```tsx
// mobile/src/presentation/fridge/fridge-list-screen.tsx
import { useState } from 'react'
import { Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { Sidebar } from '../shared/sidebar.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { useProductsQuery } from '../../application/fridge/products.query.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { Product } from '../../domain/fridge/product.js'

const TABLET_BREAKPOINT = 768
const FILTER_LABELS: Record<LocationValue, string> = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' }

function isExpiringSoon(product: Product, withinDays = 3): boolean {
  if (!product.expiresAt) return false
  const days = (new Date(product.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  return days >= 0 && days <= withinDays
}

function FilterChip({
  label,
  active,
  onPress,
  palette,
  testID,
}: {
  label: string
  active: boolean
  onPress: () => void
  palette: SoftPalette
  testID: string
}) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={pointerCursor}
    >
      <XStack
        backgroundColor={active ? palette.accentLime : palette.mintPale}
        borderRadius={999}
        paddingVertical="$1.5"
        paddingHorizontal="$3"
      >
        <Text fontSize={12} fontWeight="700" color={active ? palette.accentLimeText : palette.mintPaleText}>
          {label}
        </Text>
      </XStack>
    </Pressable>
  )
}

function ProductRow({ product, palette }: { product: Product; palette: SoftPalette }) {
  const hover = useHoverPress()
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(tabs)/fridge/[id]', params: { id: product.id } })}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={pointerCursor}
    >
      <XStack
        backgroundColor={palette.gradientBottom}
        borderRadius={16}
        padding="$3"
        marginBottom="$2"
        alignItems="center"
        gap="$3"
      >
        <YStack flex={1}>
          <Text fontSize={14} fontWeight="700" color={palette.ink}>
            {product.name}
          </Text>
          <Text fontSize={12} color={palette.inkSecondary}>
            {product.quantity.amount} {product.quantity.unit} · {FILTER_LABELS[product.location]}
          </Text>
        </YStack>
        {isExpiringSoon(product) ? (
          <XStack backgroundColor={palette.soonBg} borderRadius={999} paddingVertical="$1" paddingHorizontal="$2.5">
            <Text fontSize={11} fontWeight="700" color={palette.soonText}>
              Bientôt périmé
            </Text>
          </XStack>
        ) : null}
      </XStack>
    </Pressable>
  )
}

export function FridgeListScreen() {
  const palette = useSoftPalette()
  const { width } = useWindowDimensions()
  const isWide = width >= TABLET_BREAKPOINT
  const [locationFilter, setLocationFilter] = useState<LocationValue | null>(null)
  const products = useProductsQuery(locationFilter ? { location: locationFilter } : undefined)

  const content = (
    <YStack flex={1} padding="$4">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={20} fontWeight="800" color={palette.ink}>
          Frigo
        </Text>
        <Pressable
          testID="fridge-add"
          onPress={() => router.push('/(tabs)/fridge/new')}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un produit"
          style={pointerCursor}
        >
          <XStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$1.5" paddingHorizontal="$3">
            <Text fontSize={13} fontWeight="800" color={palette.accentLimeText}>
              + Ajouter
            </Text>
          </XStack>
        </Pressable>
      </XStack>

      <XStack gap="$2" marginTop="$3">
        <FilterChip
          testID="fridge-filter-all"
          label="Tout"
          active={locationFilter === null}
          onPress={() => setLocationFilter(null)}
          palette={palette}
        />
        {LOCATIONS.map((location) => (
          <FilterChip
            key={location}
            testID={`fridge-filter-${location}`}
            label={FILTER_LABELS[location]}
            active={locationFilter === location}
            onPress={() => setLocationFilter(location)}
            palette={palette}
          />
        ))}
      </XStack>

      <ScrollView style={{ marginTop: 16 }} showsVerticalScrollIndicator={false}>
        {products.data?.length === 0 ? (
          <Text fontSize={13} color={palette.inkSecondary} marginTop="$4">
            Aucun produit ici pour l'instant.
          </Text>
        ) : null}
        {products.data?.map((product) => (
          <ProductRow key={product.id} product={product} palette={palette} />
        ))}
      </ScrollView>
    </YStack>
  )

  if (isWide) {
    return (
      <YStack flex={1} backgroundColor={palette.layoutSurface}>
        <SafeAreaView style={{ flex: 1 }}>
          <XStack flex={1}>
            <Sidebar
              palette={palette}
              streakDays={0}
              active="frigo"
              onOpenFrigo={() => {}}
              onOpenRecettes={() => router.push('/(tabs)/recipes')}
              onOpenCourses={() => router.push('/(tabs)/shopping-list')}
              onScan={() => router.push({ pathname: '/(tabs)/fridge/scan', params: { mode: 'create' } })}
            />
            <YStack flex={1} backgroundColor={palette.gradientBottom}>
              {content}
            </YStack>
          </XStack>
        </SafeAreaView>
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor={palette.gradientBottom}>
      <SafeAreaView style={{ flex: 1 }}>{content}</SafeAreaView>
    </YStack>
  )
}
```

- [ ] **Step 4: Wire the route**

```tsx
// mobile/src/app/(tabs)/fridge/_layout.tsx
import { Stack } from 'expo-router'

export default function FridgeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]/edit" />
      <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
```

```tsx
// mobile/src/app/(tabs)/fridge/index.tsx
import { FridgeListScreen } from '../../../presentation/fridge/fridge-list-screen.js'

export default function FridgeIndexRoute() {
  return <FridgeListScreen />
}
```

```tsx
// mobile/src/app/(tabs)/_layout.tsx — add one Tabs.Screen, after "index"
<Tabs.Screen name="fridge" options={{ title: 'Frigo' }} />
```

(Full resulting file: `index`, `fridge`, `recipes`, `shopping-list`, in that order — `fridge` is the new bounded-context route sibling to `recipes`/`shopping-list`, distinct from `index`, the dashboard.)

- [ ] **Step 5: Wire the dashboard's "Voir tout" button to the new route**

```tsx
// mobile/src/presentation/dashboard/household-dashboard.tsx — HouseholdDashboardProps: add one field
export interface HouseholdDashboardProps {
  userName: string
  onSignOut: () => void
  signOutError: string | null
  onOpenRecettes: () => void
  onOpenCourses: () => void
  onOpenFridge: () => void
}
```

Thread `onOpenFridge` through the destructured props of `HouseholdDashboard`, then replace the "Voir tout" button's handler:

```tsx
// mobile/src/presentation/dashboard/household-dashboard.tsx — was: onPress={() => setHint('Voir tout le frigo — bientôt disponible')}
onPress={onOpenFridge}
```

```tsx
// mobile/src/app/(tabs)/index.tsx — add to <HouseholdDashboard ... />
onOpenFridge={() => router.push('/(tabs)/fridge')}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd mobile && pnpm test -- src/presentation/fridge/fridge-list-screen.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 7: Typecheck and commit**

Run: `cd mobile && pnpm typecheck`
Expected: no errors (the `onOpenFridge` prop is now required — confirms Step 5's `index.tsx` edit is complete)

```bash
git add mobile/src/presentation/fridge/fridge-list-screen.tsx mobile/src/presentation/fridge/fridge-list-screen.test.tsx mobile/src/app/\(tabs\)/fridge/ mobile/src/app/\(tabs\)/_layout.tsx mobile/src/app/\(tabs\)/index.tsx mobile/src/presentation/dashboard/household-dashboard.tsx
git commit -m "feat(mobile): fridge list screen, fridge tab route, wire dashboard 'Voir tout'"
```

---

## Task 7: `fridge-detail-screen` + `[id]` route

**Files:**
- Create: `mobile/src/presentation/fridge/fridge-detail-screen.tsx`
- Create: `mobile/src/presentation/fridge/fridge-detail-screen.test.tsx`
- Create: `mobile/src/app/(tabs)/fridge/[id].tsx`

**Interfaces:**
- Consumes: `useProductQuery` (Task 5), `useDeleteProductMutation` (Task 5), `Product` (Task 1).
- Produces: `FridgeDetailScreen({ productId: string })` — routed at `/(tabs)/fridge/[id]`, navigated to from `ProductRow` (Task 6) and from the form's success path (Task 8).

- [ ] **Step 1: Write the failing screen test**

```tsx
// mobile/src/presentation/fridge/fridge-detail-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { FridgeDetailScreen } from './fridge-detail-screen.js'

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('renders the product name, quantity, and category', async () => {
  await renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />)

  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())
  expect(screen.getByText('1 L')).toBeTruthy()
  expect(screen.getByText('Produits laitiers')).toBeTruthy()
})

test('pressing delete then confirm removes the product', async () => {
  await renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('fridge-detail-delete'))
  await fireEvent.press(screen.getByTestId('fridge-detail-delete-confirm'))

  await waitFor(() => expect(screen.getByTestId('fridge-detail-deleted')).toBeTruthy())
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && pnpm test -- src/presentation/fridge/fridge-detail-screen.test.tsx`
Expected: FAIL — `Cannot find module './fridge-detail-screen.js'`

- [ ] **Step 3: Implement the screen**

```tsx
// mobile/src/presentation/fridge/fridge-detail-screen.tsx
import { useState } from 'react'
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useProductQuery } from '../../application/fridge/product.query.js'
import { useDeleteProductMutation } from '../../application/fridge/delete-product.mutation.js'

const LOCATION_LABEL = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' } as const

export function FridgeDetailScreen({ productId }: { productId: string }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const product = useProductQuery(productId)
  const deleteProduct = useDeleteProductMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
  const [confirming, setConfirming] = useState(false)
  const [deleted, setDeleted] = useState(false)

  async function handleDelete() {
    const result = await deleteProduct.mutateAsync(productId)
    if (result.ok) {
      setDeleted(true)
      router.back()
    }
  }

  if (deleted) {
    return <Text testID="fridge-detail-deleted">Produit supprimé</Text>
  }

  if (!product.data) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4">
          <Text color={palette.inkSecondary}>{product.isLoading ? 'Chargement...' : 'Produit introuvable.'}</Text>
        </YStack>
      </SafeAreaView>
    )
  }

  const p = product.data

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} padding="$4" gap="$3" backgroundColor={palette.gradientBottom}>
        <Text fontSize={22} fontWeight="800" color={palette.ink}>
          {p.name}
        </Text>
        <Text fontSize={15} color={palette.ink}>
          {p.quantity.amount} {p.quantity.unit}
        </Text>
        <Text fontSize={14} color={palette.inkSecondary}>
          {p.category}
        </Text>
        <Text fontSize={13} color={palette.inkSecondary}>
          {LOCATION_LABEL[p.location]}
        </Text>
        {p.expiresAt ? (
          <Text fontSize={13} color={palette.inkSecondary}>
            Expire le {new Date(p.expiresAt).toLocaleDateString('fr-FR')}
          </Text>
        ) : null}

        <YStack marginTop="$4" gap="$2">
          <Pressable
            testID="fridge-detail-edit"
            onPress={() => router.push({ pathname: '/(tabs)/fridge/[id]/edit', params: { id: productId } })}
            accessibilityRole="button"
            accessibilityLabel="Modifier"
            style={pointerCursor}
          >
            <YStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$2.5" alignItems="center">
              <Text fontWeight="800" color={palette.accentLimeText}>
                Modifier
              </Text>
            </YStack>
          </Pressable>

          {confirming ? (
            <Pressable
              testID="fridge-detail-delete-confirm"
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel="Confirmer la suppression"
              style={pointerCursor}
            >
              <YStack backgroundColor={palette.expiredBg} borderRadius={999} paddingVertical="$2.5" alignItems="center">
                <Text fontWeight="800" color={palette.expiredText}>
                  Confirmer la suppression
                </Text>
              </YStack>
            </Pressable>
          ) : (
            <Pressable
              testID="fridge-detail-delete"
              onPress={() => setConfirming(true)}
              accessibilityRole="button"
              accessibilityLabel="Supprimer"
              style={pointerCursor}
            >
              <YStack borderRadius={999} paddingVertical="$2.5" alignItems="center">
                <Text fontWeight="700" color={palette.expiredText}>
                  Supprimer
                </Text>
              </YStack>
            </Pressable>
          )}
        </YStack>
      </YStack>
    </SafeAreaView>
  )
}
```

- [ ] **Step 4: Wire the route**

```tsx
// mobile/src/app/(tabs)/fridge/[id].tsx
import { useLocalSearchParams } from 'expo-router'
import { FridgeDetailScreen } from '../../../presentation/fridge/fridge-detail-screen.js'

export default function FridgeDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <FridgeDetailScreen productId={id} />
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd mobile && pnpm test -- src/presentation/fridge/fridge-detail-screen.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Typecheck and commit**

Run: `cd mobile && pnpm typecheck`
Expected: no errors

```bash
git add mobile/src/presentation/fridge/fridge-detail-screen.tsx mobile/src/presentation/fridge/fridge-detail-screen.test.tsx "mobile/src/app/(tabs)/fridge/[id].tsx"
git commit -m "feat(mobile): fridge detail screen with delete"
```

---

## Task 8: `fridge-form-screen` + `new`/`[id]/edit` routes

**Files:**
- Create: `mobile/src/presentation/fridge/fridge-form-screen.tsx`
- Create: `mobile/src/presentation/fridge/fridge-form-screen.test.tsx`
- Create: `mobile/src/app/(tabs)/fridge/new.tsx`
- Create: `mobile/src/app/(tabs)/fridge/[id]/edit.tsx`

**Interfaces:**
- Consumes: `useProductQuery` (Task 5, edit mode's initial values), `useCreateProductMutation`/`useUpdateProductMutation` (Task 5), `Quantity` (Task 1), `LOCATIONS`/`LocationValue` (Task 1).
- Produces: `FridgeFormScreen({ mode: 'create' } | { mode: 'edit'; productId: string }, { prefillBarcode?: string; onSuccess?: () => void })` — routed at `/(tabs)/fridge/new` and `/(tabs)/fridge/[id]/edit`. `prefillBarcode` is read from the route's search params by the route file (not by this component — same reasoning as `FridgeDetailScreen`/`FridgeFormScreen` already taking `productId` as a plain prop rather than reading params themselves, which keeps `useLocalSearchParams()` out of components under direct-render test) and, when present, triggers a lookup to pre-fill `name`/`category`/`categories`/`openfoodfactId`.

- [ ] **Step 1: Write the failing screen test**

```tsx
// mobile/src/presentation/fridge/fridge-form-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { FridgeFormScreen } from './fridge-form-screen.js'

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('submitting a valid create form calls onSuccess', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<FridgeFormScreen mode="create" onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('fridge-form-name'), 'Beurre doux')
  await fireEvent.changeText(screen.getByTestId('fridge-form-amount'), '1')
  await fireEvent.changeText(screen.getByTestId('fridge-form-unit'), 'plaquette')
  await fireEvent.changeText(screen.getByTestId('fridge-form-category'), 'Produits laitiers')
  await fireEvent.press(screen.getByTestId('fridge-form-submit'))

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
})

test('an invalid quantity shows an inline error and does not submit', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<FridgeFormScreen mode="create" onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('fridge-form-name'), 'Beurre doux')
  await fireEvent.changeText(screen.getByTestId('fridge-form-amount'), '0')
  await fireEvent.changeText(screen.getByTestId('fridge-form-unit'), 'plaquette')
  await fireEvent.changeText(screen.getByTestId('fridge-form-category'), 'Produits laitiers')
  await fireEvent.press(screen.getByTestId('fridge-form-submit'))

  await waitFor(() =>
    expect(screen.getByText('La quantité doit être un entier supérieur à 0.')).toBeTruthy(),
  )
  expect(onSuccess).not.toHaveBeenCalled()
})

test('edit mode pre-fills the form from the existing product', async () => {
  await renderWithProviders(<FridgeFormScreen mode="edit" productId="fake-product-1" onSuccess={jest.fn()} />)

  await waitFor(() => expect(screen.getByTestId('fridge-form-name').props.value).toBe('Lait demi-écrémé'))
  expect(screen.getByTestId('fridge-form-amount').props.value).toBe('1')
  expect(screen.getByTestId('fridge-form-unit').props.value).toBe('L')
})

test('a prefillBarcode found in the lookup fixture pre-fills name/category', async () => {
  await renderWithProviders(
    <FridgeFormScreen mode="create" prefillBarcode="3017620422003" onSuccess={jest.fn()} />,
  )

  await waitFor(() =>
    expect(screen.getByTestId('fridge-form-name').props.value).toBe('Pâte à tartiner noisettes-cacao'),
  )
  expect(screen.getByTestId('fridge-form-category').props.value).toBe('Pâtes à tartiner')
})

test('a prefillBarcode not in the lookup fixture shows an informational hint, leaves the form empty', async () => {
  await renderWithProviders(<FridgeFormScreen mode="create" prefillBarcode="0000000000000" onSuccess={jest.fn()} />)

  await waitFor(() => expect(screen.getByText('Produit non trouvé, remplis les champs à la main.')).toBeTruthy())
  expect(screen.getByTestId('fridge-form-name').props.value).toBe('')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && pnpm test -- src/presentation/fridge/fridge-form-screen.test.tsx`
Expected: FAIL — `Cannot find module './fridge-form-screen.js'`

- [ ] **Step 3: Implement the screen**

```tsx
// mobile/src/presentation/fridge/fridge-form-screen.tsx
import { useEffect, useState } from 'react'
import { Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useProductQuery } from '../../application/fridge/product.query.js'
import { useProductLookupQuery } from '../../application/fridge/product-lookup.query.js'
import { useCreateProductMutation } from '../../application/fridge/create-product.mutation.js'
import { useUpdateProductMutation } from '../../application/fridge/update-product.mutation.js'
import { Quantity } from '../../domain/fridge/quantity.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'

type FridgeFormMode = { mode: 'create' } | { mode: 'edit'; productId: string }

function Field({
  testID,
  label,
  value,
  onChangeText,
  color,
}: {
  testID: string
  label: string
  value: string
  onChangeText: (text: string) => void
  color: string
}) {
  return (
    <YStack gap="$1">
      <Text fontSize={12} fontWeight="700" color={color}>
        {label}
      </Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: 10, fontSize: 15 }}
      />
    </YStack>
  )
}

export function FridgeFormScreen(props: FridgeFormMode & { onSuccess?: () => void; prefillBarcode?: string }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()

  const existing = props.mode === 'edit' ? useProductQuery(props.productId) : null
  const lookup = useProductLookupQuery(props.prefillBarcode ?? '')

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState<LocationValue>('fridge')
  const [openfoodfactId, setOpenfoodfactId] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lookupHint, setLookupHint] = useState<string | null>(null)

  useEffect(() => {
    if (props.mode === 'edit' && existing?.data) {
      setName(existing.data.name)
      setAmount(String(existing.data.quantity.amount))
      setUnit(existing.data.quantity.unit)
      setCategory(existing.data.category)
      setLocation(existing.data.location)
      setOpenfoodfactId(existing.data.openfoodfactId)
      setCategories(existing.data.categories)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.data])

  useEffect(() => {
    if (props.prefillBarcode) lookup.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.prefillBarcode])

  useEffect(() => {
    if (!lookup.isFetched) return
    if (lookup.data) {
      setName(lookup.data.name)
      setCategory(lookup.data.category ?? '')
      setCategories(lookup.data.categories)
      setOpenfoodfactId(lookup.data.openfoodfactId)
      setLookupHint(null)
    } else {
      // A real, expected outcome (barcode not in OpenFoodFacts) — not an ApiError, so it
      // gets an informational hint rather than the `error` state used for form validation.
      setLookupHint('Produit non trouvé, remplis les champs à la main.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup.isFetched, lookup.data])

  const createProduct = useCreateProductMutation()
  const updateProduct = useUpdateProductMutation()
  const pending = createProduct.isPending || updateProduct.isPending

  async function handleSubmit() {
    setError(null)
    const quantity = Quantity.create(Number(amount), unit)
    if (!quantity.ok) {
      setError(quantity.error.message)
      return
    }
    if (name.trim().length === 0) {
      setError('Le nom est requis.')
      return
    }
    if (category.trim().length === 0) {
      setError('La catégorie est requise.')
      return
    }

    const payload = { name: name.trim(), quantity: quantity.value, location, category: category.trim(), openfoodfactId, categories }

    const result =
      props.mode === 'create'
        ? await createProduct.mutateAsync(payload)
        : await updateProduct.mutateAsync({ productId: props.productId, patch: payload })

    if (!result.ok) {
      setError(result.error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['products'] })
    if (props.mode === 'edit') queryClient.invalidateQueries({ queryKey: ['product', props.productId] })

    if (props.onSuccess) {
      props.onSuccess()
      return
    }
    router.back()
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} padding="$4" gap="$3" backgroundColor={palette.gradientBottom}>
        <Text fontSize={20} fontWeight="800" color={palette.ink}>
          {props.mode === 'create' ? 'Ajouter un produit' : 'Modifier le produit'}
        </Text>

        <Field testID="fridge-form-name" label="Nom" value={name} onChangeText={setName} color={palette.ink} />
        <Field testID="fridge-form-amount" label="Quantité" value={amount} onChangeText={setAmount} color={palette.ink} />
        <Field testID="fridge-form-unit" label="Unité" value={unit} onChangeText={setUnit} color={palette.ink} />
        <Field testID="fridge-form-category" label="Catégorie" value={category} onChangeText={setCategory} color={palette.ink} />

        <YStack gap="$1">
          <Text fontSize={12} fontWeight="700" color={palette.ink}>
            Emplacement
          </Text>
          <YStack flexDirection="row" gap="$2">
            {LOCATIONS.map((loc) => (
              <Pressable
                key={loc}
                testID={`fridge-form-location-${loc}`}
                onPress={() => setLocation(loc)}
                accessibilityRole="button"
                accessibilityState={{ selected: location === loc }}
                style={pointerCursor}
              >
                <YStack
                  backgroundColor={location === loc ? palette.accentLime : palette.mintPale}
                  borderRadius={999}
                  paddingVertical="$1.5"
                  paddingHorizontal="$3"
                >
                  <Text fontSize={12} fontWeight="700" color={location === loc ? palette.accentLimeText : palette.mintPaleText}>
                    {loc}
                  </Text>
                </YStack>
              </Pressable>
            ))}
          </YStack>
        </YStack>

        <Pressable
          testID="fridge-form-scan"
          onPress={() =>
            router.push(
              props.mode === 'create'
                ? { pathname: '/(tabs)/fridge/scan', params: { mode: 'create' } }
                : { pathname: '/(tabs)/fridge/scan', params: { mode: 'edit', productId: props.productId } },
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Scanner un code-barres"
          style={pointerCursor}
        >
          <Text fontSize={13} fontWeight="700" color={palette.mintPaleText}>
            Scanner un code-barres
          </Text>
        </Pressable>

        {lookupHint ? (
          <Text fontSize={12} color={palette.inkSecondary}>
            {lookupHint}
          </Text>
        ) : null}

        {error ? (
          <Text fontSize={13} color={palette.expiredText}>
            {error}
          </Text>
        ) : null}

        <Pressable
          testID="fridge-form-submit"
          onPress={handleSubmit}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer"
          style={pointerCursor}
        >
          <YStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$2.5" alignItems="center">
            <Text fontWeight="800" color={palette.accentLimeText}>
              {pending ? 'Enregistrement...' : 'Enregistrer'}
            </Text>
          </YStack>
        </Pressable>
      </YStack>
    </SafeAreaView>
  )
}
```

- [ ] **Step 4: Wire the routes**

```tsx
// mobile/src/app/(tabs)/fridge/new.tsx
import { useLocalSearchParams } from 'expo-router'
import { FridgeFormScreen } from '../../../presentation/fridge/fridge-form-screen.js'

export default function FridgeNewRoute() {
  const { prefillBarcode } = useLocalSearchParams<{ prefillBarcode?: string }>()
  return <FridgeFormScreen mode="create" prefillBarcode={prefillBarcode} />
}
```

```tsx
// mobile/src/app/(tabs)/fridge/[id]/edit.tsx
import { useLocalSearchParams } from 'expo-router'
import { FridgeFormScreen } from '../../../../presentation/fridge/fridge-form-screen.js'

export default function FridgeEditRoute() {
  const { id, prefillBarcode } = useLocalSearchParams<{ id: string; prefillBarcode?: string }>()
  return <FridgeFormScreen mode="edit" productId={id} prefillBarcode={prefillBarcode} />
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd mobile && pnpm test -- src/presentation/fridge/fridge-form-screen.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Typecheck and commit**

Run: `cd mobile && pnpm typecheck`
Expected: no errors

```bash
git add mobile/src/presentation/fridge/fridge-form-screen.tsx mobile/src/presentation/fridge/fridge-form-screen.test.tsx mobile/src/app/\(tabs\)/fridge/new.tsx "mobile/src/app/(tabs)/fridge/[id]/edit.tsx"
git commit -m "feat(mobile): fridge add/edit form with inline validation"
```

---

## Task 9: `barcode-scanner-screen` + `scan` route + dashboard scan FAB

**Files:**
- Create: `mobile/src/presentation/fridge/barcode-scanner-screen.tsx`
- Create: `mobile/src/presentation/fridge/barcode-scanner-screen.test.tsx`
- Create: `mobile/src/app/(tabs)/fridge/scan.tsx`
- Modify: `mobile/src/presentation/dashboard/household-dashboard.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `CameraView`, `useCameraPermissions` (`'expo-camera'`, Task 4).
- Produces: `BarcodeScannerScreen({ mode: 'create' } | { mode: 'edit'; productId: string })` — routed at `/(tabs)/fridge/scan` as a modal. On a scanned barcode, navigates to `new`/`[id]/edit` with a `prefillBarcode` search param, which Task 8's form reads.

The scanner's own responsibility is narrow: ask for camera permission, render `CameraView`, and on `onBarcodeScanned` navigate away with the barcode — the actual lookup and pre-fill happen in `FridgeFormScreen` (Task 8), already wired to `prefillBarcode`. This keeps `expo-camera` (unmockable in Jest) isolated to one small component whose only testable logic is the scan handler, exercised directly rather than through the camera.

- [ ] **Step 1: Write the failing test for the scan handler**

```tsx
// mobile/src/presentation/fridge/barcode-scanner-screen.test.tsx
import { render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { BarcodeScannerScreen } from './barcode-scanner-screen.js'

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}))

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))

test('scanning a barcode in create mode navigates to the new-product form with prefillBarcode', async () => {
  await render(<BarcodeScannerScreen mode="create" />)

  const camera = screen.UNSAFE_getByType('CameraView' as never)
  camera.props.onBarcodeScanned({ data: '3017620422003' })

  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/(tabs)/fridge/new',
    params: { prefillBarcode: '3017620422003' },
  })
})

test('scanning a barcode in edit mode navigates to that product\'s edit form with prefillBarcode', async () => {
  await render(<BarcodeScannerScreen mode="edit" productId="fake-product-1" />)

  const camera = screen.UNSAFE_getByType('CameraView' as never)
  camera.props.onBarcodeScanned({ data: '3017620422003' })

  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/(tabs)/fridge/[id]/edit',
    params: { id: 'fake-product-1', prefillBarcode: '3017620422003' },
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && pnpm test -- src/presentation/fridge/barcode-scanner-screen.test.tsx`
Expected: FAIL — `Cannot find module './barcode-scanner-screen.js'`

- [ ] **Step 3: Implement the screen**

```tsx
// mobile/src/presentation/fridge/barcode-scanner-screen.tsx
import { useState } from 'react'
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

type BarcodeScannerMode = { mode: 'create' } | { mode: 'edit'; productId: string }

export function BarcodeScannerScreen(props: BarcodeScannerMode) {
  const palette = useSoftPalette()
  const [permission, requestPermission] = useCameraPermissions()
  const [handled, setHandled] = useState(false)

  function handleBarcodeScanned({ data }: { data: string }) {
    if (handled) return
    setHandled(true)
    if (props.mode === 'edit') {
      router.replace({ pathname: '/(tabs)/fridge/[id]/edit', params: { id: props.productId, prefillBarcode: data } })
      return
    }
    router.replace({ pathname: '/(tabs)/fridge/new', params: { prefillBarcode: data } })
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4" gap="$3" alignItems="center" justifyContent="center">
          <Text fontSize={14} color={palette.ink} textAlign="center">
            L'accès à la caméra est nécessaire pour scanner un code-barres.
          </Text>
          <Pressable
            testID="barcode-scanner-request-permission"
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="Autoriser la caméra"
            style={pointerCursor}
          >
            <YStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$2.5" paddingHorizontal="$4">
              <Text fontWeight="800" color={palette.accentLimeText}>
                Autoriser la caméra
              </Text>
            </YStack>
          </Pressable>
        </YStack>
      </SafeAreaView>
    )
  }

  return (
    <YStack flex={1}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <Pressable
          testID="barcode-scanner-close"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Fermer le scanner"
          style={[pointerCursor, { padding: 16 }]}
        >
          <Text fontSize={24} color="#FFFFFF">
            ×
          </Text>
        </Pressable>
      </SafeAreaView>
    </YStack>
  )
}
```

- [ ] **Step 4: Wire the route**

```tsx
// mobile/src/app/(tabs)/fridge/scan.tsx
import { useLocalSearchParams } from 'expo-router'
import { BarcodeScannerScreen } from '../../../presentation/fridge/barcode-scanner-screen.js'

export default function FridgeScanRoute() {
  const { mode, productId } = useLocalSearchParams<{ mode: 'create' | 'edit'; productId?: string }>()
  if (mode === 'edit' && productId) return <BarcodeScannerScreen mode="edit" productId={productId} />
  return <BarcodeScannerScreen mode="create" />
}
```

- [ ] **Step 5: Wire the dashboard's scan FAB and Sidebar scan button to the new route**

```tsx
// mobile/src/presentation/dashboard/household-dashboard.tsx — HouseholdDashboardProps: add one more field
onScanProduct: () => void
```

Thread `onScanProduct` through the destructured props, then replace both existing `setHint('Scanner — bientôt disponible')` call sites — the mobile FAB and the `Sidebar`'s `onScan` prop — with `onScanProduct`.

```tsx
// mobile/src/app/(tabs)/index.tsx — add to <HouseholdDashboard ... />
onScanProduct={() => router.push({ pathname: '/(tabs)/fridge/scan', params: { mode: 'create' } })}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd mobile && pnpm test -- src/presentation/fridge/barcode-scanner-screen.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 7: Run the full test suite, typecheck, and lint**

Run: `cd mobile && pnpm test && pnpm typecheck && pnpm lint`
Expected: everything passes — this is the last task in the sub-project, confirming the whole fridge slice (domain → application → infrastructure → presentation → routes → dashboard wiring) is coherent together.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/presentation/fridge/barcode-scanner-screen.tsx mobile/src/presentation/fridge/barcode-scanner-screen.test.tsx mobile/src/app/\(tabs\)/fridge/scan.tsx mobile/src/presentation/dashboard/household-dashboard.tsx mobile/src/app/\(tabs\)/index.tsx
git commit -m "feat(mobile): barcode scanner screen, wire dashboard scan FAB"
```
