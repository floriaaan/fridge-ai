# Mobile Receipt Scan + Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile receipt-scan (photograph/pick a receipt → AI extraction → editable review → import as fridge products, plus a read-only history) and AI-provider settings sub-project — sub-project 2/3 of the mobile fridge/receipt/settings work — wired to the backend's already-shipped `/api/receipts/*` and `/api/settings/ai` endpoints.

**Architecture:** Same layered structure as every prior mobile phase: `domain/receipt` + `domain/settings` (plain types) → `application/receipt` + `application/settings` (TanStack Query hooks over the `FridgeConnector` abstraction) → `infrastructure/{http,fake}` (the two `FridgeConnector` implementations) → `presentation/{receipt,settings,shared}` (screens + one new reusable `ActionSheet`) → `app/(tabs)/{receipts/*,settings}` (expo-router routes), plus wiring the dashboard's existing scan FAB and Sidebar scan button to offer a choice between "scan a product" (existing) and "scan a receipt" (new), and adding a "Réglages" link next to the existing sign-out link. One list of tasks, in dependency order; each task's tests pass before moving to the next.

**Tech Stack:** Expo Router (typed routes), TanStack Query, Tamagui (`YStack`/`XStack`/`Text`/`Input`/`Button`), `expo-camera` (already a dependency), `expo-image-picker` (new dependency, gallery picker), `jest-expo` + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-08-29-mobile-receipt-settings-design.md`

## Global Constraints

- Every backend-facing method returns `Promise<Result<T, ApiError>>` for mutating calls, or a plain (possibly empty/null) value for reads — exactly the existing `FridgeConnector` convention. Never throw for an expected backend error.
- `ReceiptDraft`/`Receipt`/`ImportReceiptInput`/`AiSettings` field names are structurally identical to the backend's `receipt.dto.ts`/`receipt.validator.ts`/`ai-settings.dto.ts` — no re-mapping.
- `GET /receipts/:id/image` is never consumed — the backend never sets a non-null `imageKey` on import in this phase (no receipt-image write path exists server-side yet).
- No receipt image is persisted client-side either — the photo only ever travels to `POST /receipts/scan` for extraction.
- All new mobile files use the `.js` extension in relative imports (ESM interop, matches every existing mobile source file) even though the files on disk are `.ts`/`.tsx`.
- New user-facing strings are French, matching every other mobile screen.
- Only the dashboard's FAB and Sidebar scan entry points change; `fridge-list-screen.tsx`'s own Sidebar instance keeps going straight to the barcode scanner (out of this sub-project's scope, per spec).

---

## Task 1: Domain layer — `ReceiptDraft`, `Receipt`, `ImportReceiptInput`, `AiSettings`

**Files:**
- Create: `mobile/src/domain/receipt/receipt-draft.ts`
- Create: `mobile/src/domain/receipt/receipt.ts`
- Create: `mobile/src/domain/settings/ai-settings.ts`

**Interfaces:**
- Produces: `ReceiptDraftItem { name: string; quantity: number; unit: string; category: string | null; price: number | null }`; `ReceiptDraft { storeName: string; scannedAt: string; totalAmount: number; items: ReceiptDraftItem[] }`; `Receipt { id, storeName, scannedAt, totalAmount, imageKey: string | null, itemsCount: number, createdAt }`; `ImportReceiptItemInput { name; quantity; unit; category?; price?; location: LocationValue; expiresAt?: string | null }`; `ImportReceiptInput { storeName; scannedAt; totalAmount; items: ImportReceiptItemInput[] }`; `AiProvider = 'gemini' | 'openai' | 'ollama'`; `AI_PROVIDERS: readonly AiProvider[]`; `AiSettings { activeProvider: AiProvider; source: 'database' | 'environment'; availableProviders: AiProvider[] }`.

No test-first step here — these are plain type/const declarations with no branching logic to assert on, same treatment `location.ts`'s `LocationValue`/`LOCATIONS` got in the fridge inventory phase.

- [ ] **Step 1: Write the domain files**

```ts
// mobile/src/domain/receipt/receipt-draft.ts
/** Mirrors `ReceiptDraftDto` (`backend/src/presentation/receipt/receipt.dto.ts`) field-for-field. */
export interface ReceiptDraftItem {
  name: string
  quantity: number
  unit: string
  category: string | null
  price: number | null
}

export interface ReceiptDraft {
  storeName: string
  scannedAt: string
  totalAmount: number
  items: ReceiptDraftItem[]
}
```

```ts
// mobile/src/domain/receipt/receipt.ts
import type { LocationValue } from '../fridge/location.js'

/** Mirrors `ReceiptDto` (`backend/src/presentation/receipt/receipt.dto.ts`) field-for-field. */
export interface Receipt {
  id: string
  storeName: string
  scannedAt: string
  totalAmount: number
  imageKey: string | null
  itemsCount: number
  createdAt: string
}

/**
 * Mirrors `importReceiptValidator` (`backend/src/presentation/receipt/
 * receipt.validator.ts`) — `location`/`expiresAt` aren't on `ReceiptDraftItem`
 * (the backend only requires them at import time), so the review screen
 * collects them before submitting.
 */
export interface ImportReceiptItemInput {
  name: string
  quantity: number
  unit: string
  category?: string | null
  price?: number | null
  location: LocationValue
  expiresAt?: string | null
}

export interface ImportReceiptInput {
  storeName: string
  scannedAt: string
  totalAmount: number
  items: ImportReceiptItemInput[]
}
```

```ts
// mobile/src/domain/settings/ai-settings.ts
export type AiProvider = 'gemini' | 'openai' | 'ollama'

export const AI_PROVIDERS: readonly AiProvider[] = ['gemini', 'openai', 'ollama']

/** Mirrors `AiSettingsDto` (= backend's `EffectiveAiSettings`) field-for-field. */
export interface AiSettings {
  activeProvider: AiProvider
  source: 'database' | 'environment'
  availableProviders: AiProvider[]
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

```bash
git add mobile/src/domain/receipt mobile/src/domain/settings
git commit -m "feat(mobile): receipt and AI settings domain types"
```

---

## Task 2: `http-client` — `apiFetchMultipart` for the receipt-scan upload

**Files:**
- Modify: `mobile/src/infrastructure/http/http-client.ts`
- Test: `mobile/src/infrastructure/http/http-client.test.ts`

**Interfaces:**
- Consumes: `Result` (`mobile/src/domain/shared/result.js`), `ApiError` (`mobile/src/domain/shared/api-error.js`).
- Produces: `apiFetchMultipart<T>(path: string, formData: FormData): Promise<Result<T, ApiError>>`.

- [ ] **Step 1: Write the failing test**

```ts
// Append to mobile/src/infrastructure/http/http-client.test.ts
import { apiFetch, apiFetchMultipart } from './http-client.js'

test('apiFetchMultipart() POSTs the given FormData without a JSON Content-Type header', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ draft: { storeName: 'Carrefour' } }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const formData = new FormData()
  const result = await apiFetchMultipart<{ draft: { storeName: string } }>('/api/receipts/scan', formData)

  expect(result).toEqual({ ok: true, value: { draft: { storeName: 'Carrefour' } } })
  const [, init] = fetchMock.mock.calls[0]
  expect(init.method).toBe('POST')
  expect(init.body).toBe(formData)
  expect(init.headers).toBeUndefined()
})

test('apiFetchMultipart() maps a non-ok response to Result.err', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 422,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'extraction_failed', message: 'oops' } }),
  }) as unknown as typeof fetch

  const result = await apiFetchMultipart('/api/receipts/scan', new FormData())

  expect(result).toEqual({ ok: false, error: { type: 'extraction_failed', message: 'oops' } })
})
```

Note the existing test file already imports `apiFetch` and stores `originalFetch` — reuse that pattern (restore `globalThis.fetch = originalFetch` at the end of each new test too, matching the file's existing tests).

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && npx jest src/infrastructure/http/http-client.test.ts`
Expected: FAIL — `apiFetchMultipart is not a function` (or import error).

- [ ] **Step 3: Implement `apiFetchMultipart`**

```ts
// mobile/src/infrastructure/http/http-client.ts — add below apiFetch
/**
 * Like `apiFetch`, but for a `FormData` body (the one client→server call
 * that isn't JSON: the receipt-scan image upload). No `Content-Type`
 * header is set — `fetch` derives the multipart boundary from the
 * `FormData` instance itself, and setting it manually would drop that
 * boundary.
 */
export async function apiFetchMultipart<T>(path: string, formData: FormData): Promise<Result<T, ApiError>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
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

Run: `cd mobile && npx jest src/infrastructure/http/http-client.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/infrastructure/http/http-client.ts mobile/src/infrastructure/http/http-client.test.ts
git commit -m "feat(mobile): apiFetchMultipart for the receipt-scan image upload"
```

---

## Task 3: `FridgeConnector` — extend with the `receipt` + `settings` method groups

**Files:**
- Modify: `mobile/src/domain/interfaces/fridge-connector.ts`
- Modify: `mobile/src/infrastructure/http/http-fridge-connector.ts`
- Test: `mobile/src/infrastructure/http/http-fridge-connector.test.ts`
- Create: `mobile/src/infrastructure/fake/fixtures/receipt-draft.fixture.ts`
- Create: `mobile/src/infrastructure/fake/fixtures/receipt.fixture.ts`
- Create: `mobile/src/infrastructure/fake/fixtures/ai-settings.fixture.ts`
- Modify: `mobile/src/infrastructure/fake/fake-fridge-connector.ts`
- Test: `mobile/src/infrastructure/fake/fake-fridge-connector.test.ts` (create if it doesn't already exist; check first)

**Interfaces:**
- Consumes: `ReceiptDraft`, `Receipt`, `ImportReceiptInput` (Task 1's `domain/receipt`), `AiSettings`, `AiProvider` (Task 1's `domain/settings`), `apiFetch`/`apiFetchMultipart` (Task 2), `Product` (existing `domain/fridge/product.js`).
- Produces (added to `FridgeConnector`, implemented by both classes):
  ```ts
  scanReceipt(imageUri: string): Promise<Result<ReceiptDraft, ApiError>>
  importReceipt(input: ImportReceiptInput): Promise<Result<{ receipt: Receipt; products: Product[] }, ApiError>>
  getReceipts(): Promise<Receipt[]>
  getReceipt(receiptId: string): Promise<{ receipt: Receipt; products: Product[] } | null>
  getAiSettings(): Promise<AiSettings | null>
  setActiveAiProvider(provider: AiProvider): Promise<Result<AiSettings, ApiError>>
  ```

- [ ] **Step 1: Extend the `FridgeConnector` interface**

```ts
// mobile/src/domain/interfaces/fridge-connector.ts — add imports and methods
import type { ReceiptDraft } from '../receipt/receipt-draft.js'
import type { Receipt, ImportReceiptInput } from '../receipt/receipt.js'
import type { AiSettings, AiProvider } from '../settings/ai-settings.js'

export interface FridgeConnector {
  // ...existing methods...
  scanReceipt(imageUri: string): Promise<Result<ReceiptDraft, ApiError>>
  importReceipt(input: ImportReceiptInput): Promise<Result<{ receipt: Receipt; products: Product[] }, ApiError>>
  getReceipts(): Promise<Receipt[]>
  getReceipt(receiptId: string): Promise<{ receipt: Receipt; products: Product[] } | null>
  getAiSettings(): Promise<AiSettings | null>
  setActiveAiProvider(provider: AiProvider): Promise<Result<AiSettings, ApiError>>
}
```

- [ ] **Step 2: Write the failing `HttpFridgeConnector` tests**

```ts
// Append to mobile/src/infrastructure/http/http-fridge-connector.test.ts
test('scanReceipt() posts a multipart image and unwraps the draft', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () =>
      Promise.resolve({
        draft: { storeName: 'Carrefour', scannedAt: '2026-08-28T10:00:00.000Z', totalAmount: 24.5, items: [] },
      }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.scanReceipt('file://receipt.jpg')

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.storeName).toBe('Carrefour')
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/receipts/scan')
  expect(init.body).toBeInstanceOf(FormData)

  globalThis.fetch = originalFetch
})

test('scanReceipt() returns Result.err on an extraction failure', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 422,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'extraction_failed', message: 'Extraction impossible.' } }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.scanReceipt('file://receipt.jpg')

  expect(result).toEqual({ ok: false, error: { type: 'extraction_failed', message: 'Extraction impossible.' } })

  globalThis.fetch = originalFetch
})

test('importReceipt() posts the JSON payload and unwraps receipt + products', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 201,
    ok: true,
    json: () =>
      Promise.resolve({
        receipt: { id: 'r1', storeName: 'Carrefour', scannedAt: '2026-08-28T10:00:00.000Z', totalAmount: 24.5, imageKey: null, itemsCount: 1, createdAt: '2026-08-28T10:05:00.000Z' },
        products: [],
      }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.importReceipt({
    storeName: 'Carrefour',
    scannedAt: '2026-08-28T10:00:00.000Z',
    totalAmount: 24.5,
    items: [{ name: 'Lait', quantity: 1, unit: 'L', location: 'fridge' }],
  })

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.receipt.id).toBe('r1')
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/receipts/import')
  expect(init.method).toBe('POST')

  globalThis.fetch = originalFetch
})

test('getReceipts() returns [] when the request fails', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 500,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'server_error', message: 'oops' } }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  expect(await connector.getReceipts()).toEqual([])

  globalThis.fetch = originalFetch
})

test('getReceipt() returns null when the backend finds nothing', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 404,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'receipt_not_found', message: 'not found' } }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  expect(await connector.getReceipt('missing')).toBeNull()

  globalThis.fetch = originalFetch
})

test('getAiSettings() unwraps the settings object directly (no envelope key)', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ activeProvider: 'gemini', source: 'environment', availableProviders: ['gemini'] }),
  }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const settings = await connector.getAiSettings()

  expect(settings).toEqual({ activeProvider: 'gemini', source: 'environment', availableProviders: ['gemini'] })

  globalThis.fetch = originalFetch
})

test('setActiveAiProvider() PATCHes the provider and returns Result.ok with the updated settings', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ activeProvider: 'openai', source: 'database', availableProviders: ['gemini', 'openai'] }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.setActiveAiProvider('openai')

  expect(result).toEqual({ ok: true, value: { activeProvider: 'openai', source: 'database', availableProviders: ['gemini', 'openai'] } })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/settings/ai')
  expect(init.method).toBe('PATCH')
  expect(JSON.parse(init.body)).toEqual({ provider: 'openai' })

  globalThis.fetch = originalFetch
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd mobile && npx jest src/infrastructure/http/http-fridge-connector.test.ts`
Expected: FAIL — `connector.scanReceipt is not a function` (and similar for the other new methods).

- [ ] **Step 4: Implement the methods on `HttpFridgeConnector`**

```ts
// mobile/src/infrastructure/http/http-fridge-connector.ts
import { apiFetch, apiFetchMultipart } from './http-client.js'
import type { ReceiptDraft } from '../../domain/receipt/receipt-draft.js'
import type { Receipt, ImportReceiptInput } from '../../domain/receipt/receipt.js'
import type { AiSettings, AiProvider } from '../../domain/settings/ai-settings.js'

// ...inside class HttpFridgeConnector...

  async scanReceipt(imageUri: string): Promise<Result<ReceiptDraft, ApiError>> {
    const formData = new FormData()
    // React Native's FormData accepts this { uri, name, type } shape for a file
    // part — it isn't a real Blob/File, but that's the platform's documented
    // multipart-upload convention, not a real DOM Blob.
    formData.append('image', { uri: imageUri, name: 'receipt.jpg', type: 'image/jpeg' } as unknown as Blob)
    const result = await apiFetchMultipart<{ draft: ReceiptDraft }>('/api/receipts/scan', formData)
    return result.ok ? Result.ok(result.value.draft) : Result.err(result.error)
  }

  async importReceipt(input: ImportReceiptInput): Promise<Result<{ receipt: Receipt; products: Product[] }, ApiError>> {
    const result = await apiFetch<{ receipt: Receipt; products: Product[] }>('/api/receipts/import', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async getReceipts(): Promise<Receipt[]> {
    const result = await apiFetch<{ receipts: Receipt[] }>('/api/receipts')
    return result.ok ? result.value.receipts : []
  }

  async getReceipt(receiptId: string): Promise<{ receipt: Receipt; products: Product[] } | null> {
    const result = await apiFetch<{ receipt: Receipt; products: Product[] }>(`/api/receipts/${receiptId}`)
    return result.ok ? result.value : null
  }

  async getAiSettings(): Promise<AiSettings | null> {
    const result = await apiFetch<AiSettings>('/api/settings/ai')
    return result.ok ? result.value : null
  }

  async setActiveAiProvider(provider: AiProvider): Promise<Result<AiSettings, ApiError>> {
    const result = await apiFetch<AiSettings>('/api/settings/ai', {
      method: 'PATCH',
      body: JSON.stringify({ provider }),
    })
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd mobile && npx jest src/infrastructure/http/http-fridge-connector.test.ts`
Expected: PASS, all tests (existing + new).

- [ ] **Step 6: Write fixtures**

```ts
// mobile/src/infrastructure/fake/fixtures/receipt-draft.fixture.ts
import type { ReceiptDraft } from '../../../domain/receipt/receipt-draft.js'

export const fakeReceiptDraft: ReceiptDraft = {
  storeName: 'Carrefour',
  scannedAt: '2026-08-28T10:00:00.000Z',
  totalAmount: 24.5,
  items: [
    { name: 'Lait demi-écrémé', quantity: 2, unit: 'L', category: 'Produits laitiers', price: 2.4 },
    { name: 'Pain de mie', quantity: 1, unit: 'pièce', category: 'Boulangerie', price: 1.8 },
  ],
}
```

```ts
// mobile/src/infrastructure/fake/fixtures/receipt.fixture.ts
import type { Receipt } from '../../../domain/receipt/receipt.js'

export const fakeReceipts: Receipt[] = [
  {
    id: 'fake-receipt-1',
    storeName: 'Carrefour',
    scannedAt: '2026-08-20T10:00:00.000Z',
    totalAmount: 24.5,
    imageKey: null,
    itemsCount: 2,
    createdAt: '2026-08-20T10:05:00.000Z',
  },
]
```

```ts
// mobile/src/infrastructure/fake/fixtures/ai-settings.fixture.ts
import type { AiSettings } from '../../../domain/settings/ai-settings.js'

export const fakeAiSettings: AiSettings = {
  activeProvider: 'gemini',
  source: 'environment',
  availableProviders: ['gemini', 'openai'],
}
```

- [ ] **Step 7: Write the failing `FakeFridgeConnector` tests**

Check whether `mobile/src/infrastructure/fake/fake-fridge-connector.test.ts` already exists (run `ls mobile/src/infrastructure/fake/`). If it doesn't, create it fresh with just these tests; if it does, append to it.

```ts
// mobile/src/infrastructure/fake/fake-fridge-connector.test.ts
import { FakeFridgeConnector } from './fake-fridge-connector.js'

test('scanReceipt() resolves with the fixture draft regardless of the imageUri', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.scanReceipt('file://anything.jpg')

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.storeName).toBe('Carrefour')
})

test('importReceipt() creates a receipt and one product per item, linked by receiptId', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.importReceipt({
    storeName: 'Monoprix',
    scannedAt: '2026-08-29T09:00:00.000Z',
    totalAmount: 10,
    items: [{ name: 'Yaourts', quantity: 1, unit: 'pack', location: 'fridge' }],
  })

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.value.receipt.storeName).toBe('Monoprix')
  expect(result.value.products).toHaveLength(1)
  expect(result.value.products[0].receiptId).toBe(result.value.receipt.id)

  const receipts = await connector.getReceipts()
  expect(receipts.some((r) => r.id === result.value.receipt.id)).toBe(true)
})

test('getReceipt() returns the receipt and its imported products', async () => {
  const connector = new FakeFridgeConnector()
  const imported = await connector.importReceipt({
    storeName: 'Monoprix',
    scannedAt: '2026-08-29T09:00:00.000Z',
    totalAmount: 10,
    items: [{ name: 'Yaourts', quantity: 1, unit: 'pack', location: 'fridge' }],
  })
  if (!imported.ok) throw new Error('setup failed')

  const found = await connector.getReceipt(imported.value.receipt.id)

  expect(found?.receipt.id).toBe(imported.value.receipt.id)
  expect(found?.products).toHaveLength(1)
})

test('getReceipt() returns null for an unknown id', async () => {
  const connector = new FakeFridgeConnector()
  expect(await connector.getReceipt('missing')).toBeNull()
})

test('getAiSettings() returns the fixture settings', async () => {
  const connector = new FakeFridgeConnector()
  expect(await connector.getAiSettings()).toEqual({
    activeProvider: 'gemini',
    source: 'environment',
    availableProviders: ['gemini', 'openai'],
  })
})

test('setActiveAiProvider() switches the active provider when it is available', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.setActiveAiProvider('openai')

  expect(result).toEqual({
    ok: true,
    value: { activeProvider: 'openai', source: 'environment', availableProviders: ['gemini', 'openai'] },
  })
})

test('setActiveAiProvider() rejects a provider that is not in availableProviders', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.setActiveAiProvider('ollama')

  expect(result.ok).toBe(false)
})
```

- [ ] **Step 8: Run it to verify it fails**

Run: `cd mobile && npx jest src/infrastructure/fake/fake-fridge-connector.test.ts`
Expected: FAIL — `connector.scanReceipt is not a function` (and similar).

- [ ] **Step 9: Implement the methods on `FakeFridgeConnector`**

```ts
// mobile/src/infrastructure/fake/fake-fridge-connector.ts
import { fakeReceiptDraft } from './fixtures/receipt-draft.fixture.js'
import { fakeReceipts } from './fixtures/receipt.fixture.js'
import { fakeAiSettings } from './fixtures/ai-settings.fixture.js'
import type { ReceiptDraft } from '../../domain/receipt/receipt-draft.js'
import type { Receipt, ImportReceiptInput } from '../../domain/receipt/receipt.js'
import type { AiSettings, AiProvider } from '../../domain/settings/ai-settings.js'

export class FakeFridgeConnector implements FridgeConnector {
  // ...existing fields...
  private receipts: Receipt[] = fakeReceipts.map((r) => ({ ...r }))
  private nextReceiptId = 1
  private aiSettings: AiSettings = { ...fakeAiSettings, availableProviders: [...fakeAiSettings.availableProviders] }

  // ...existing methods...

  async scanReceipt(_imageUri: string): Promise<Result<ReceiptDraft, ApiError>> {
    return Result.ok({ ...fakeReceiptDraft, items: fakeReceiptDraft.items.map((item) => ({ ...item })) })
  }

  async importReceipt(input: ImportReceiptInput): Promise<Result<{ receipt: Receipt; products: Product[] }, ApiError>> {
    const now = new Date().toISOString()
    const receipt: Receipt = {
      id: `fake-receipt-new-${this.nextReceiptId++}`,
      storeName: input.storeName,
      scannedAt: input.scannedAt,
      totalAmount: input.totalAmount,
      imageKey: null,
      itemsCount: input.items.length,
      createdAt: now,
    }
    this.receipts.push(receipt)

    const products: Product[] = input.items.map((item) => {
      const product: Product = {
        id: `fake-product-from-receipt-${this.nextProductId++}`,
        name: item.name,
        quantity: { amount: item.quantity, unit: item.unit },
        location: item.location,
        category: item.category ?? 'Non classé',
        expiresAt: item.expiresAt ?? null,
        openedAt: null,
        categories: null,
        openfoodfactId: null,
        receiptId: receipt.id,
        price: item.price ?? null,
        imageKey: null,
        createdAt: now,
        updatedAt: now,
      }
      this.products.push(product)
      return product
    })

    return Result.ok({ receipt, products })
  }

  async getReceipts(): Promise<Receipt[]> {
    return this.receipts
  }

  async getReceipt(receiptId: string): Promise<{ receipt: Receipt; products: Product[] } | null> {
    const receipt = this.receipts.find((r) => r.id === receiptId)
    if (!receipt) return null
    return { receipt, products: this.products.filter((p) => p.receiptId === receiptId) }
  }

  async getAiSettings(): Promise<AiSettings | null> {
    return this.aiSettings
  }

  async setActiveAiProvider(provider: AiProvider): Promise<Result<AiSettings, ApiError>> {
    if (!this.aiSettings.availableProviders.includes(provider)) {
      return Result.err({ type: 'provider_not_available', message: "Ce fournisseur n'est pas configuré." })
    }
    this.aiSettings = { ...this.aiSettings, activeProvider: provider }
    return Result.ok(this.aiSettings)
  }
}
```

`nextProductId` is the private counter the class already has from Task 1 of the fridge inventory phase — reuse it as-is, don't add a second one.

- [ ] **Step 10: Run tests to verify they pass**

Run: `cd mobile && npx jest src/infrastructure/fake/fake-fridge-connector.test.ts`
Expected: PASS, all tests.

- [ ] **Step 11: Typecheck, run the full suite, and commit**

Run: `cd mobile && npx tsc --noEmit && npx jest`
Expected: no type errors; full suite green.

```bash
git add mobile/src/domain/interfaces/fridge-connector.ts mobile/src/infrastructure
git commit -m "feat(mobile): extend FridgeConnector with receipt and AI settings ops"
```

---

## Task 4: `expo-image-picker` dependency + permission config

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app.json`

**Interfaces:** None — dependency + config only, no application code yet.

- [ ] **Step 1: Install the dependency**

Run: `cd mobile && npx expo install expo-image-picker`
Expected: adds `expo-image-picker` to `mobile/package.json` at the SDK-57-compatible version and updates the lockfile (same mechanism `expo-camera` was added with, commit `3f61a89`).

- [ ] **Step 2: Add the plugin config**

```json
// mobile/app.json — inside "plugins", after the existing "expo-camera" entry
[
  "expo-image-picker",
  {
    "photosPermission": "Fridge AI a besoin d'accéder à tes photos pour importer un ticket de caisse."
  }
]
```

- [ ] **Step 3: Verify install and typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/package.json mobile/app.json pnpm-lock.yaml
git commit -m "chore(mobile): add expo-image-picker for receipt gallery import"
```

---

## Task 5: Application layer — receipt and settings queries/mutations

**Files:**
- Create: `mobile/src/application/receipt/scan-receipt.mutation.ts`
- Create: `mobile/src/application/receipt/import-receipt.mutation.ts`
- Create: `mobile/src/application/receipt/receipts.query.ts`
- Create: `mobile/src/application/receipt/receipt.query.ts`
- Create: `mobile/src/application/settings/ai-settings.query.ts`
- Create: `mobile/src/application/settings/set-active-ai-provider.mutation.ts`

**Interfaces:**
- Consumes: `defineQuery`, `defineMutation` (`mobile/src/application/shared/{define-query,define-mutation}.js`), the six `FridgeConnector` methods from Task 3.
- Produces: `useScanReceiptMutation()`, `useImportReceiptMutation()`, `useReceiptsQuery()`, `useReceiptQuery(receiptId: string)`, `useAiSettingsQuery()`, `useSetActiveAiProviderMutation()` — each a thin wrapper, same shape as every existing hook in `application/fridge` and `application/shopping-list`. No test file: these hooks have no branching logic of their own (same as `products.query.ts`/`create-product.mutation.ts`, which also ship untested — their behavior is exercised through the screens that use them in later tasks).

- [ ] **Step 1: Write the six hooks**

```ts
// mobile/src/application/receipt/scan-receipt.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'

export const useScanReceiptMutation = defineMutation((connector, imageUri: string) => connector.scanReceipt(imageUri))
```

```ts
// mobile/src/application/receipt/import-receipt.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'
import type { ImportReceiptInput } from '../../domain/receipt/receipt.js'

export const useImportReceiptMutation = defineMutation((connector, input: ImportReceiptInput) =>
  connector.importReceipt(input),
)
```

```ts
// mobile/src/application/receipt/receipts.query.ts
import { defineQuery } from '../shared/define-query.js'

export const useReceiptsQuery = defineQuery(['receipts'], (connector) => connector.getReceipts())
```

```ts
// mobile/src/application/receipt/receipt.query.ts
import { useDomainQuery } from '../shared/use-domain-query.js'

export function useReceiptQuery(receiptId: string) {
  return useDomainQuery(['receipt', receiptId], (connector) => connector.getReceipt(receiptId), {
    enabled: receiptId.length > 0,
  })
}
```

```ts
// mobile/src/application/settings/ai-settings.query.ts
import { defineQuery } from '../shared/define-query.js'

export const useAiSettingsQuery = defineQuery(['ai-settings'], (connector) => connector.getAiSettings())
```

```ts
// mobile/src/application/settings/set-active-ai-provider.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'
import type { AiProvider } from '../../domain/settings/ai-settings.js'

export const useSetActiveAiProviderMutation = defineMutation((connector, provider: AiProvider) =>
  connector.setActiveAiProvider(provider),
)
```

- [ ] **Step 2: Typecheck and commit**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

```bash
git add mobile/src/application/receipt mobile/src/application/settings
git commit -m "feat(mobile): TanStack queries/mutations for receipt and AI settings"
```

---

## Task 6: `ActionSheet` — shared two-option bottom sheet

**Files:**
- Create: `mobile/src/presentation/shared/action-sheet.tsx`
- Test: `mobile/src/presentation/shared/action-sheet.test.tsx`

**Interfaces:**
- Produces: `ActionSheetOption { testID: string; label: string; onPress: () => void }`; `ActionSheet({ visible: boolean; onClose: () => void; options: ActionSheetOption[] })` — a JSX component. Used by Task 12 to offer "Scanner un produit" / "Scanner un ticket de caisse" from the dashboard's FAB and Sidebar scan button.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/src/presentation/shared/action-sheet.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from './theme-provider.js'
import { ActionSheet } from './action-sheet.js'

test('renders nothing when not visible', () => {
  render(
    <ThemeProvider>
      <ActionSheet visible={false} onClose={jest.fn()} options={[{ testID: 'opt-a', label: 'A', onPress: jest.fn() }]} />
    </ThemeProvider>,
  )

  expect(screen.queryByTestId('opt-a')).toBeNull()
})

test('renders one pressable row per option and calls its onPress when tapped', () => {
  const onPress = jest.fn()
  render(
    <ThemeProvider>
      <ActionSheet visible onClose={jest.fn()} options={[{ testID: 'opt-a', label: 'A', onPress }]} />
    </ThemeProvider>,
  )

  fireEvent.press(screen.getByTestId('opt-a'))

  expect(onPress).toHaveBeenCalledTimes(1)
})

test('pressing the backdrop calls onClose', () => {
  const onClose = jest.fn()
  render(
    <ThemeProvider>
      <ActionSheet visible onClose={onClose} options={[]} />
    </ThemeProvider>,
  )

  fireEvent.press(screen.getByTestId('action-sheet-backdrop'))

  expect(onClose).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && npx jest src/presentation/shared/action-sheet.test.tsx`
Expected: FAIL — cannot find module `./action-sheet.js`.

- [ ] **Step 3: Implement `ActionSheet`**

```tsx
// mobile/src/presentation/shared/action-sheet.tsx
import { Modal, Pressable } from 'react-native'
import { Text, YStack } from './tamagui-typed.js'
import { pointerCursor } from './hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

export interface ActionSheetOption {
  testID: string
  label: string
  onPress: () => void
}

/**
 * A minimal two-to-a-few-option bottom sheet — no new library (the app has
 * no other action-sheet usage to justify one, and this keeps behavior
 * identical across web/iOS/Android instead of reaching for the
 * iOS-only `ActionSheetIOS`). Renders nothing at all when `visible` is
 * false, rather than relying on RN `Modal`'s own `visible` prop, so tests
 * don't depend on how the test renderer mocks `Modal`.
 */
export function ActionSheet({
  visible,
  onClose,
  options,
}: {
  visible: boolean
  onClose: () => void
  options: ActionSheetOption[]
}) {
  const palette = useSoftPalette()
  if (!visible) return null

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        testID="action-sheet-backdrop"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
      >
        <YStack backgroundColor={palette.layoutSurface} borderTopLeftRadius={24} borderTopRightRadius={24} padding="$4" gap="$1">
          {options.map((option) => (
            <Pressable
              key={option.testID}
              testID={option.testID}
              onPress={option.onPress}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              style={pointerCursor}
            >
              <YStack paddingVertical="$3" paddingHorizontal="$2">
                <Text fontSize={15} fontWeight="700" color={palette.ink}>
                  {option.label}
                </Text>
              </YStack>
            </Pressable>
          ))}
        </YStack>
      </Pressable>
    </Modal>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest src/presentation/shared/action-sheet.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/presentation/shared/action-sheet.tsx mobile/src/presentation/shared/action-sheet.test.tsx
git commit -m "feat(mobile): ActionSheet shared component"
```

---

## Task 7: `receipt-scanner-screen` + `receipts/scan` route

**Files:**
- Create: `mobile/src/presentation/receipt/receipt-scanner-screen.tsx`
- Test: `mobile/src/presentation/receipt/receipt-scanner-screen.test.tsx`
- Create: `mobile/src/app/(tabs)/receipts/scan.tsx`

**Interfaces:**
- Consumes: `useCameraPermissions`/`CameraView` (`expo-camera`), `launchImageLibraryAsync`/`MediaTypeOptions` (`expo-image-picker`), `router` (`expo-router`).
- Produces: `ReceiptScannerScreen()` — on a successful capture or gallery pick, navigates to `/(tabs)/receipts/review` with `params: { imageUri: string }`.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/src/presentation/receipt/receipt-scanner-screen.test.tsx
import { act, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptScannerScreen } from './receipt-scanner-screen.js'

const mockTakePictureAsync = jest.fn()
const mockLaunchImageLibraryAsync = jest.fn()

jest.mock('expo-camera', () => {
  const React = require('react')
  return {
    CameraView: React.forwardRef((props: { testID?: string }, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePictureAsync }))
      return React.createElement('CameraView', { testID: props.testID })
    }),
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
  }
})

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
  MediaTypeOptions: { Images: 'Images' },
}))

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn() } }))

beforeEach(() => {
  jest.clearAllMocks()
})

test('capturing a photo navigates to the review screen with its uri', async () => {
  mockTakePictureAsync.mockResolvedValue({ uri: 'file://receipt.jpg' })
  await render(
    <ThemeProvider>
      <ReceiptScannerScreen />
    </ThemeProvider>,
  )

  await act(async () => {
    screen.getByTestId('receipt-scanner-capture').props.onPress()
  })

  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/(tabs)/receipts/review',
    params: { imageUri: 'file://receipt.jpg' },
  })
})

test('picking a photo from the gallery navigates to the review screen with its uri', async () => {
  mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://gallery.jpg' }] })
  await render(
    <ThemeProvider>
      <ReceiptScannerScreen />
    </ThemeProvider>,
  )

  await act(async () => {
    screen.getByTestId('receipt-scanner-gallery').props.onPress()
  })

  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/(tabs)/receipts/review',
    params: { imageUri: 'file://gallery.jpg' },
  })
})

test('canceling the gallery picker does not navigate', async () => {
  mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null })
  await render(
    <ThemeProvider>
      <ReceiptScannerScreen />
    </ThemeProvider>,
  )

  await act(async () => {
    screen.getByTestId('receipt-scanner-gallery').props.onPress()
  })

  expect(router.replace).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && npx jest src/presentation/receipt/receipt-scanner-screen.test.tsx`
Expected: FAIL — cannot find module `./receipt-scanner-screen.js`.

- [ ] **Step 3: Implement `ReceiptScannerScreen`**

```tsx
// mobile/src/presentation/receipt/receipt-scanner-screen.tsx
import { useRef, useState } from 'react'
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

export function ReceiptScannerScreen() {
  const palette = useSoftPalette()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [capturing, setCapturing] = useState(false)

  function goToReview(imageUri: string) {
    router.replace({ pathname: '/(tabs)/receipts/review', params: { imageUri } })
  }

  async function handleCapture() {
    if (!cameraRef.current || capturing) return
    setCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 })
      if (photo?.uri) goToReview(photo.uri)
    } finally {
      setCapturing(false)
    }
  }

  async function handlePickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]) goToReview(result.assets[0].uri)
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4" gap="$3" alignItems="center" justifyContent="center">
          <Text fontSize={14} color={palette.ink} textAlign="center">
            L&apos;accès à la caméra est nécessaire pour scanner un ticket de caisse.
          </Text>
          <Pressable
            testID="receipt-scanner-request-permission"
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
          <Pressable
            testID="receipt-scanner-gallery-fallback"
            onPress={handlePickFromGallery}
            accessibilityRole="button"
            accessibilityLabel="Choisir une photo dans la galerie"
            style={pointerCursor}
          >
            <Text fontSize={13} fontWeight="700" color={palette.mintPaleText}>
              Choisir une photo dans la galerie
            </Text>
          </Pressable>
        </YStack>
      </SafeAreaView>
    )
  }

  return (
    <YStack flex={1}>
      <CameraView testID="receipt-scanner-camera" ref={cameraRef} style={{ flex: 1 }} />
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <Pressable
          testID="receipt-scanner-close"
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
      <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <YStack flexDirection="row" justifyContent="center" alignItems="center" gap="$4" padding="$4">
          <Pressable
            testID="receipt-scanner-gallery"
            onPress={handlePickFromGallery}
            accessibilityRole="button"
            accessibilityLabel="Choisir une photo dans la galerie"
            style={pointerCursor}
          >
            <YStack backgroundColor="rgba(255,255,255,0.85)" borderRadius={999} paddingVertical="$2.5" paddingHorizontal="$4">
              <Text fontSize={13} fontWeight="700" color={palette.ink}>
                Galerie
              </Text>
            </YStack>
          </Pressable>
          <Pressable
            testID="receipt-scanner-capture"
            onPress={handleCapture}
            disabled={capturing}
            accessibilityRole="button"
            accessibilityLabel="Prendre la photo"
            style={pointerCursor}
          >
            <YStack width={64} height={64} borderRadius={32} backgroundColor={palette.accentLime} borderWidth={4} borderColor="#FFFFFF" />
          </Pressable>
        </YStack>
      </SafeAreaView>
    </YStack>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest src/presentation/receipt/receipt-scanner-screen.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 5: Add the route**

```tsx
// mobile/src/app/(tabs)/receipts/scan.tsx
import { ReceiptScannerScreen } from '../../../presentation/receipt/receipt-scanner-screen.js'

export default function ReceiptScanRoute() {
  return <ReceiptScannerScreen />
}
```

- [ ] **Step 6: Typecheck and commit**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

```bash
git add mobile/src/presentation/receipt/receipt-scanner-screen.tsx mobile/src/presentation/receipt/receipt-scanner-screen.test.tsx "mobile/src/app/(tabs)/receipts/scan.tsx"
git commit -m "feat(mobile): receipt-scanner-screen (camera + gallery)"
```

---

## Task 8: `ReceiptItemRow` + `receipt-review-screen` + `receipts/review` route

**Files:**
- Create: `mobile/src/presentation/receipt/receipt-item-row.tsx`
- Test: `mobile/src/presentation/receipt/receipt-item-row.test.tsx`
- Create: `mobile/src/presentation/receipt/receipt-review-screen.tsx`
- Test: `mobile/src/presentation/receipt/receipt-review-screen.test.tsx`
- Create: `mobile/src/app/(tabs)/receipts/review.tsx`

**Interfaces:**
- Consumes: `ReceiptDraftItem` (Task 1), `ImportReceiptItemInput` (Task 1), `LOCATIONS`/`LocationValue` (existing `domain/fridge/location.js`), `FormField` (existing `presentation/fridge/form-field.js`), `useScanReceiptMutation`/`useImportReceiptMutation` (Task 5).
- Produces: `ReceiptItemRow({ item: EditableReceiptItem; onChange: (item: EditableReceiptItem) => void; index: number })` where `EditableReceiptItem = { name: string; quantity: string; unit: string; category: string; price: string; location: LocationValue; expiresAt: string }` (string fields for the text inputs, converted at submit time — same pattern `fridge-form-screen.tsx` uses for `amount`/`expiresAt`); `ReceiptReviewScreen({ imageUri: string })`.

- [ ] **Step 1: Write the failing `ReceiptItemRow` test**

```tsx
// mobile/src/presentation/receipt/receipt-item-row.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptItemRow, type EditableReceiptItem } from './receipt-item-row.js'

const baseItem: EditableReceiptItem = {
  name: 'Lait',
  quantity: '2',
  unit: 'L',
  category: 'Produits laitiers',
  price: '2.4',
  location: 'fridge',
  expiresAt: '',
}

test('editing the name calls onChange with the updated item', () => {
  const onChange = jest.fn()
  render(
    <ThemeProvider>
      <ReceiptItemRow index={0} item={baseItem} onChange={onChange} />
    </ThemeProvider>,
  )

  fireEvent.changeText(screen.getByTestId('receipt-item-0-name'), 'Lait entier')

  expect(onChange).toHaveBeenCalledWith({ ...baseItem, name: 'Lait entier' })
})

test('selecting a location pill calls onChange with the new location', () => {
  const onChange = jest.fn()
  render(
    <ThemeProvider>
      <ReceiptItemRow index={0} item={baseItem} onChange={onChange} />
    </ThemeProvider>,
  )

  fireEvent.press(screen.getByTestId('receipt-item-0-location-freezer'))

  expect(onChange).toHaveBeenCalledWith({ ...baseItem, location: 'freezer' })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && npx jest src/presentation/receipt/receipt-item-row.test.tsx`
Expected: FAIL — cannot find module `./receipt-item-row.js`.

- [ ] **Step 3: Implement `ReceiptItemRow`**

```tsx
// mobile/src/presentation/receipt/receipt-item-row.tsx
import { Pressable } from 'react-native'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { FormField } from '../fridge/form-field.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'

/**
 * String fields for every text input (same convention `fridge-form-screen.tsx`
 * uses for `amount`/`expiresAt`) — parsed/validated once, at submit time, in
 * `receipt-review-screen.tsx`, not on every keystroke here.
 */
export interface EditableReceiptItem {
  name: string
  quantity: string
  unit: string
  category: string
  price: string
  location: LocationValue
  expiresAt: string
}

const LOCATION_LABELS: Record<LocationValue, string> = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' }

export function ReceiptItemRow({
  index,
  item,
  onChange,
}: {
  index: number
  item: EditableReceiptItem
  onChange: (item: EditableReceiptItem) => void
}) {
  const palette = useSoftPalette()

  function set<K extends keyof EditableReceiptItem>(key: K, value: EditableReceiptItem[K]) {
    onChange({ ...item, [key]: value })
  }

  return (
    <YStack backgroundColor={palette.gradientBottom} borderRadius={16} padding="$3" gap="$2" marginBottom="$2">
      <FormField testID={`receipt-item-${index}-name`} label="Nom" value={item.name} onChangeText={(v) => set('name', v)} color={palette.ink} />
      <FormField testID={`receipt-item-${index}-quantity`} label="Quantité" value={item.quantity} onChangeText={(v) => set('quantity', v)} color={palette.ink} />
      <FormField testID={`receipt-item-${index}-unit`} label="Unité" value={item.unit} onChangeText={(v) => set('unit', v)} color={palette.ink} />
      <FormField testID={`receipt-item-${index}-category`} label="Catégorie" value={item.category} onChangeText={(v) => set('category', v)} color={palette.ink} />
      <FormField testID={`receipt-item-${index}-price`} label="Prix" value={item.price} onChangeText={(v) => set('price', v)} color={palette.ink} />
      <FormField
        testID={`receipt-item-${index}-expires-at`}
        label="Date de péremption (AAAA-MM-JJ)"
        value={item.expiresAt}
        onChangeText={(v) => set('expiresAt', v)}
        color={palette.ink}
      />

      <YStack gap="$1">
        <Text fontSize={12} fontWeight="700" color={palette.ink}>
          Emplacement
        </Text>
        <YStack flexDirection="row" gap="$2">
          {LOCATIONS.map((loc) => (
            <Pressable
              key={loc}
              testID={`receipt-item-${index}-location-${loc}`}
              onPress={() => set('location', loc)}
              accessibilityRole="button"
              accessibilityState={{ selected: item.location === loc }}
              style={pointerCursor}
            >
              <YStack
                backgroundColor={item.location === loc ? palette.accentLime : palette.mintPale}
                borderRadius={999}
                paddingVertical="$1.5"
                paddingHorizontal="$3"
              >
                <Text fontSize={12} fontWeight="700" color={item.location === loc ? palette.accentLimeText : palette.mintPaleText}>
                  {LOCATION_LABELS[loc]}
                </Text>
              </YStack>
            </Pressable>
          ))}
        </YStack>
      </YStack>
    </YStack>
  )
}
```

- [ ] **Step 4: Run the `ReceiptItemRow` tests to verify they pass**

Run: `cd mobile && npx jest src/presentation/receipt/receipt-item-row.test.tsx`
Expected: PASS, both tests.

- [ ] **Step 5: Write the failing `ReceiptReviewScreen` test**

```tsx
// mobile/src/presentation/receipt/receipt-review-screen.test.tsx
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptReviewScreen } from './receipt-review-screen.js'

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))

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

beforeEach(() => {
  jest.clearAllMocks()
})

test('scans the image on mount and pre-fills the form from the draft', async () => {
  renderWithProviders(<ReceiptReviewScreen imageUri="file://receipt.jpg" />)

  await waitFor(() => expect(screen.getByTestId('receipt-review-store-name').props.value).toBe('Carrefour'))
  expect(screen.getByTestId('receipt-item-0-name').props.value).toBe('Lait demi-écrémé')
})

test('importing sends every item with its chosen location and navigates to the dashboard on success', async () => {
  renderWithProviders(<ReceiptReviewScreen imageUri="file://receipt.jpg" />)

  await waitFor(() => expect(screen.getByTestId('receipt-item-0-name').props.value).toBe('Lait demi-écrémé'))

  await act(async () => {
    fireEvent.press(screen.getByTestId('receipt-review-submit'))
  })

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'))
})

test('shows a retry hint when the scan fails', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  connector.scanReceipt = jest.fn().mockResolvedValue({ ok: false, error: { type: 'extraction_failed', message: 'Extraction impossible.' } })

  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ReceiptReviewScreen imageUri="file://receipt.jpg" />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByText('Extraction impossible, réessaie ou vérifie ta photo.')).toBeTruthy())
  expect(screen.getByTestId('receipt-review-retry')).toBeTruthy()
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd mobile && npx jest src/presentation/receipt/receipt-review-screen.test.tsx`
Expected: FAIL — cannot find module `./receipt-review-screen.js`.

- [ ] **Step 7: Implement `ReceiptReviewScreen`**

```tsx
// mobile/src/presentation/receipt/receipt-review-screen.tsx
import { useEffect, useRef, useState } from 'react'
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { FormField } from '../fridge/form-field.js'
import { ReceiptItemRow, type EditableReceiptItem } from './receipt-item-row.js'
import { useScanReceiptMutation } from '../../application/receipt/scan-receipt.mutation.js'
import { useImportReceiptMutation } from '../../application/receipt/import-receipt.mutation.js'
import type { ReceiptDraftItem } from '../../domain/receipt/receipt-draft.js'

function toEditable(item: ReceiptDraftItem): EditableReceiptItem {
  return {
    name: item.name,
    quantity: String(item.quantity),
    unit: item.unit,
    category: item.category ?? '',
    price: item.price !== null ? String(item.price) : '',
    location: 'fridge',
    expiresAt: '',
  }
}

export function ReceiptReviewScreen({ imageUri }: { imageUri: string }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const scanReceipt = useScanReceiptMutation()
  const importReceipt = useImportReceiptMutation()

  const [storeName, setStoreName] = useState('')
  const [scannedAt, setScannedAt] = useState('')
  const [totalAmount, setTotalAmount] = useState(0)
  const [items, setItems] = useState<EditableReceiptItem[]>([])
  const [scanError, setScanError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const startedRef = useRef(false)

  async function runScan() {
    setScanError(null)
    const result = await scanReceipt.mutateAsync(imageUri)
    if (!result.ok) {
      setScanError('Extraction impossible, réessaie ou vérifie ta photo.')
      return
    }
    setStoreName(result.value.storeName)
    setScannedAt(result.value.scannedAt.slice(0, 10))
    setTotalAmount(result.value.totalAmount)
    setItems(result.value.items.map(toEditable))
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    runScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateItem(index: number, next: EditableReceiptItem) {
    setItems((current) => current.map((item, i) => (i === index ? next : item)))
  }

  async function handleSubmit() {
    setSubmitError(null)
    const parsedItems = []
    for (const item of items) {
      const quantity = Number(item.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setSubmitError(`Quantité invalide pour "${item.name || 'un article'}".`)
        return
      }
      if (item.name.trim().length === 0) {
        setSubmitError('Chaque article doit avoir un nom.')
        return
      }
      parsedItems.push({
        name: item.name.trim(),
        quantity,
        unit: item.unit.trim(),
        category: item.category.trim().length > 0 ? item.category.trim() : null,
        price: item.price.trim().length > 0 ? Number(item.price) : null,
        location: item.location,
        expiresAt: item.expiresAt.trim().length > 0 ? new Date(item.expiresAt.trim()).toISOString() : null,
      })
    }

    const result = await importReceipt.mutateAsync({
      storeName: storeName.trim(),
      scannedAt: scannedAt.trim().length > 0 ? new Date(scannedAt.trim()).toISOString() : new Date().toISOString(),
      totalAmount,
      items: parsedItems,
    })

    if (!result.ok) {
      setSubmitError(result.error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['products'] })
    router.replace('/(tabs)')
  }

  if (scanReceipt.isPending && items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Text fontSize={14} color={palette.ink}>
            Analyse du ticket en cours…
          </Text>
        </YStack>
      </SafeAreaView>
    )
  }

  if (scanError) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4" gap="$3" alignItems="center" justifyContent="center">
          <Text fontSize={14} color={palette.expiredText} textAlign="center">
            {scanError}
          </Text>
          <Pressable
            testID="receipt-review-retry"
            onPress={runScan}
            accessibilityRole="button"
            accessibilityLabel="Réessayer"
            style={pointerCursor}
          >
            <YStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$2.5" paddingHorizontal="$4">
              <Text fontWeight="800" color={palette.accentLimeText}>
                Réessayer
              </Text>
            </YStack>
          </Pressable>
        </YStack>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: palette.gradientBottom }} contentContainerStyle={{ padding: 16 }}>
        <Text fontSize={20} fontWeight="800" color={palette.ink} marginBottom={12}>
          Vérifier le ticket
        </Text>

        <FormField testID="receipt-review-store-name" label="Magasin" value={storeName} onChangeText={setStoreName} color={palette.ink} />
        <FormField
          testID="receipt-review-scanned-at"
          label="Date (AAAA-MM-JJ)"
          value={scannedAt}
          onChangeText={setScannedAt}
          color={palette.ink}
        />
        <Text fontSize={13} color={palette.inkSecondary} marginTop={4} marginBottom={12}>
          Total : {totalAmount.toFixed(2)} €
        </Text>

        {items.map((item, index) => (
          <ReceiptItemRow key={index} index={index} item={item} onChange={(next) => updateItem(index, next)} />
        ))}

        {submitError ? (
          <Text fontSize={13} color={palette.expiredText} marginBottom={8}>
            {submitError}
          </Text>
        ) : null}

        <Pressable
          testID="receipt-review-submit"
          onPress={handleSubmit}
          disabled={importReceipt.isPending}
          accessibilityRole="button"
          accessibilityLabel="Importer"
          style={pointerCursor}
        >
          <YStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$3" alignItems="center">
            <Text fontWeight="800" color={palette.accentLimeText}>
              Importer
            </Text>
          </YStack>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd mobile && npx jest src/presentation/receipt/receipt-review-screen.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 9: Add the route**

```tsx
// mobile/src/app/(tabs)/receipts/review.tsx
import { useLocalSearchParams } from 'expo-router'
import { ReceiptReviewScreen } from '../../../presentation/receipt/receipt-review-screen.js'

export default function ReceiptReviewRoute() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>()
  return <ReceiptReviewScreen imageUri={imageUri} />
}
```

- [ ] **Step 10: Typecheck and commit**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

```bash
git add mobile/src/presentation/receipt/receipt-item-row.tsx mobile/src/presentation/receipt/receipt-item-row.test.tsx mobile/src/presentation/receipt/receipt-review-screen.tsx mobile/src/presentation/receipt/receipt-review-screen.test.tsx "mobile/src/app/(tabs)/receipts/review.tsx"
git commit -m "feat(mobile): receipt-review-screen with editable items, import flow"
```

---

## Task 9: `receipts-list-screen` + `receipts` index route

**Files:**
- Create: `mobile/src/presentation/receipt/receipts-list-screen.tsx`
- Test: `mobile/src/presentation/receipt/receipts-list-screen.test.tsx`
- Create: `mobile/src/app/(tabs)/receipts/index.tsx`

**Interfaces:**
- Consumes: `useReceiptsQuery` (Task 5), `Receipt` (Task 1), `router` (`expo-router`).
- Produces: `ReceiptsListScreen()`.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/src/presentation/receipt/receipts-list-screen.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptsListScreen } from './receipts-list-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={new FakeFridgeConnector()}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('lists the fixture receipts and navigates to the detail screen on tap', async () => {
  renderWithProviders(<ReceiptsListScreen />)

  await waitFor(() => expect(screen.getByText('Carrefour')).toBeTruthy())

  fireEvent.press(screen.getByText('Carrefour'))

  expect(router.push).toHaveBeenCalledWith({ pathname: '/(tabs)/receipts/[id]', params: { id: 'fake-receipt-1' } })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && npx jest src/presentation/receipt/receipts-list-screen.test.tsx`
Expected: FAIL — cannot find module `./receipts-list-screen.js`.

- [ ] **Step 3: Implement `ReceiptsListScreen`**

```tsx
// mobile/src/presentation/receipt/receipts-list-screen.tsx
import { Pressable, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useReceiptsQuery } from '../../application/receipt/receipts.query.js'
import type { Receipt } from '../../domain/receipt/receipt.js'

function ReceiptRow({ receipt, palette }: { receipt: Receipt; palette: ReturnType<typeof useSoftPalette> }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(tabs)/receipts/[id]', params: { id: receipt.id } })}
      accessibilityRole="button"
      accessibilityLabel={receipt.storeName}
      style={pointerCursor}
    >
      <XStack backgroundColor={palette.gradientBottom} borderRadius={16} padding="$3" marginBottom="$2" justifyContent="space-between">
        <YStack>
          <Text fontSize={14} fontWeight="700" color={palette.ink}>
            {receipt.storeName}
          </Text>
          <Text fontSize={12} color={palette.inkSecondary}>
            {receipt.scannedAt.slice(0, 10)} · {receipt.itemsCount} article{receipt.itemsCount > 1 ? 's' : ''}
          </Text>
        </YStack>
        <Text fontSize={14} fontWeight="700" color={palette.ink}>
          {receipt.totalAmount.toFixed(2)} €
        </Text>
      </XStack>
    </Pressable>
  )
}

export function ReceiptsListScreen() {
  const palette = useSoftPalette()
  const receipts = useReceiptsQuery()

  return (
    <YStack flex={1} backgroundColor={palette.gradientBottom}>
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4">
          <Text fontSize={20} fontWeight="800" color={palette.ink} marginBottom="$3">
            Historique des tickets
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {receipts.data?.length === 0 ? (
              <Text fontSize={13} color={palette.inkSecondary}>
                Aucun ticket importé pour l&apos;instant.
              </Text>
            ) : null}
            {receipts.data?.map((receipt) => (
              <ReceiptRow key={receipt.id} receipt={receipt} palette={palette} />
            ))}
          </ScrollView>
        </YStack>
      </SafeAreaView>
    </YStack>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest src/presentation/receipt/receipts-list-screen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the route**

```tsx
// mobile/src/app/(tabs)/receipts/index.tsx
import { ReceiptsListScreen } from '../../../presentation/receipt/receipts-list-screen.js'

export default function ReceiptsListRoute() {
  return <ReceiptsListScreen />
}
```

- [ ] **Step 6: Typecheck and commit**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

```bash
git add mobile/src/presentation/receipt/receipts-list-screen.tsx mobile/src/presentation/receipt/receipts-list-screen.test.tsx "mobile/src/app/(tabs)/receipts/index.tsx"
git commit -m "feat(mobile): receipts-list-screen"
```

---

## Task 10: `receipt-detail-screen` + `receipts/[id]` route

**Files:**
- Create: `mobile/src/presentation/receipt/receipt-detail-screen.tsx`
- Test: `mobile/src/presentation/receipt/receipt-detail-screen.test.tsx`
- Create: `mobile/src/app/(tabs)/receipts/[id].tsx`

**Interfaces:**
- Consumes: `useReceiptQuery` (Task 5), `Receipt`/`Product` types.
- Produces: `ReceiptDetailScreen({ receiptId: string })`.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/src/presentation/receipt/receipt-detail-screen.test.tsx
import { render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptDetailScreen } from './receipt-detail-screen.js'

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={new FakeFridgeConnector()}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('shows the receipt header and its imported products', async () => {
  renderWithProviders(<ReceiptDetailScreen receiptId="fake-receipt-1" />)

  await waitFor(() => expect(screen.getByText('Carrefour')).toBeTruthy())
})

test('shows a not-found message for an unknown receipt', async () => {
  renderWithProviders(<ReceiptDetailScreen receiptId="missing" />)

  await waitFor(() => expect(screen.getByText('Ticket introuvable.')).toBeTruthy())
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && npx jest src/presentation/receipt/receipt-detail-screen.test.tsx`
Expected: FAIL — cannot find module `./receipt-detail-screen.js`.

- [ ] **Step 3: Implement `ReceiptDetailScreen`**

```tsx
// mobile/src/presentation/receipt/receipt-detail-screen.tsx
import { ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useReceiptQuery } from '../../application/receipt/receipt.query.js'

export function ReceiptDetailScreen({ receiptId }: { receiptId: string }) {
  const palette = useSoftPalette()
  const query = useReceiptQuery(receiptId)

  if (query.isPending) return null

  if (!query.data) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Text fontSize={14} color={palette.ink}>
            Ticket introuvable.
          </Text>
        </YStack>
      </SafeAreaView>
    )
  }

  const { receipt, products } = query.data

  return (
    <YStack flex={1} backgroundColor={palette.gradientBottom}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text fontSize={20} fontWeight="800" color={palette.ink}>
            {receipt.storeName}
          </Text>
          <Text fontSize={13} color={palette.inkSecondary} marginTop="$1">
            {receipt.scannedAt.slice(0, 10)} · {receipt.totalAmount.toFixed(2)} €
          </Text>

          <YStack marginTop="$4" gap="$2">
            {products.map((product) => (
              <XStack key={product.id} backgroundColor={palette.mintPale} borderRadius={16} padding="$3" justifyContent="space-between">
                <Text fontSize={14} fontWeight="700" color={palette.mintPaleText}>
                  {product.name}
                </Text>
                <Text fontSize={13} color={palette.mintPaleText}>
                  {product.quantity.amount} {product.quantity.unit}
                </Text>
              </XStack>
            ))}
          </YStack>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest src/presentation/receipt/receipt-detail-screen.test.tsx`
Expected: PASS, both tests.

- [ ] **Step 5: Add the route**

```tsx
// mobile/src/app/(tabs)/receipts/[id].tsx
import { useLocalSearchParams } from 'expo-router'
import { ReceiptDetailScreen } from '../../../presentation/receipt/receipt-detail-screen.js'

export default function ReceiptDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ReceiptDetailScreen receiptId={id} />
}
```

- [ ] **Step 6: Typecheck and commit**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

```bash
git add mobile/src/presentation/receipt/receipt-detail-screen.tsx mobile/src/presentation/receipt/receipt-detail-screen.test.tsx "mobile/src/app/(tabs)/receipts/[id].tsx"
git commit -m "feat(mobile): receipt-detail-screen"
```

---

## Task 11: `settings-screen` + `settings` route

**Files:**
- Create: `mobile/src/presentation/settings/settings-screen.tsx`
- Test: `mobile/src/presentation/settings/settings-screen.test.tsx`
- Create: `mobile/src/app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: `useAiSettingsQuery`, `useSetActiveAiProviderMutation` (Task 5), `AI_PROVIDERS`/`AiProvider` (Task 1), `router` (`expo-router`).
- Produces: `SettingsScreen()`.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/src/presentation/settings/settings-screen.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { SettingsScreen } from './settings-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

function renderWithProviders(connector: FakeFridgeConnector) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <SettingsScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('shows only the available providers with the active one selected, plus the source', async () => {
  renderWithProviders(new FakeFridgeConnector())

  await waitFor(() => expect(screen.getByTestId('ai-provider-gemini')).toBeTruthy())
  expect(screen.queryByTestId('ai-provider-ollama')).toBeNull()
  expect(screen.getByTestId('ai-provider-gemini').props.accessibilityState.selected).toBe(true)
  expect(screen.getByText('Configuré par l’administrateur')).toBeTruthy()
})

test('tapping an unselected provider switches the active one', async () => {
  renderWithProviders(new FakeFridgeConnector())

  await waitFor(() => expect(screen.getByTestId('ai-provider-openai')).toBeTruthy())

  fireEvent.press(screen.getByTestId('ai-provider-openai'))

  await waitFor(() => expect(screen.getByTestId('ai-provider-openai').props.accessibilityState.selected).toBe(true))
})

test('has a link to the receipt history', async () => {
  renderWithProviders(new FakeFridgeConnector())

  await waitFor(() => expect(screen.getByTestId('settings-receipts-history')).toBeTruthy())

  fireEvent.press(screen.getByTestId('settings-receipts-history'))

  expect(router.push).toHaveBeenCalledWith('/(tabs)/receipts')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && npx jest src/presentation/settings/settings-screen.test.tsx`
Expected: FAIL — cannot find module `./settings-screen.js`.

- [ ] **Step 3: Implement `SettingsScreen`**

```tsx
// mobile/src/presentation/settings/settings-screen.tsx
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useAiSettingsQuery } from '../../application/settings/ai-settings.query.js'
import { useSetActiveAiProviderMutation } from '../../application/settings/set-active-ai-provider.mutation.js'
import type { AiProvider } from '../../domain/settings/ai-settings.js'

const PROVIDER_LABELS: Record<AiProvider, string> = { gemini: 'Gemini', openai: 'OpenAI', ollama: 'Ollama' }
const SOURCE_LABELS: Record<'database' | 'environment', string> = {
  environment: 'Configuré par l’administrateur',
  database: 'Choisi par le foyer',
}

export function SettingsScreen() {
  const palette = useSoftPalette()
  const settings = useAiSettingsQuery()
  const setProvider = useSetActiveAiProviderMutation()

  return (
    <YStack flex={1} backgroundColor={palette.gradientBottom}>
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4" gap="$4">
          <Text fontSize={20} fontWeight="800" color={palette.ink}>
            Réglages
          </Text>

          <YStack gap="$2">
            <Text fontSize={13} fontWeight="700" color={palette.ink}>
              Fournisseur IA
            </Text>
            {settings.data?.availableProviders.map((provider) => {
              const selected = settings.data?.activeProvider === provider
              return (
                <Pressable
                  key={provider}
                  testID={`ai-provider-${provider}`}
                  onPress={() => !selected && setProvider.mutate(provider)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={pointerCursor}
                >
                  <YStack
                    backgroundColor={selected ? palette.accentLime : palette.mintPale}
                    borderRadius={16}
                    padding="$3"
                  >
                    <Text fontSize={14} fontWeight="700" color={selected ? palette.accentLimeText : palette.mintPaleText}>
                      {PROVIDER_LABELS[provider]}
                    </Text>
                  </YStack>
                </Pressable>
              )
            })}
            {settings.data ? (
              <Text fontSize={12} color={palette.inkSecondary}>
                {SOURCE_LABELS[settings.data.source]}
              </Text>
            ) : null}
          </YStack>

          <Pressable
            testID="settings-receipts-history"
            onPress={() => router.push('/(tabs)/receipts')}
            accessibilityRole="button"
            accessibilityLabel="Historique des tickets"
            style={pointerCursor}
          >
            <Text fontSize={14} fontWeight="700" color={palette.mintPaleText}>
              Historique des tickets
            </Text>
          </Pressable>
        </YStack>
      </SafeAreaView>
    </YStack>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npx jest src/presentation/settings/settings-screen.test.tsx`
Expected: PASS, all three tests.

- [ ] **Step 5: Add the route**

```tsx
// mobile/src/app/(tabs)/settings.tsx
import { SettingsScreen } from '../../presentation/settings/settings-screen.js'

export default function SettingsRoute() {
  return <SettingsScreen />
}
```

- [ ] **Step 6: Typecheck and commit**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

```bash
git add mobile/src/presentation/settings mobile/src/presentation/settings/settings-screen.test.tsx "mobile/src/app/(tabs)/settings.tsx"
git commit -m "feat(mobile): settings-screen (AI provider selection)"
```

---

## Task 12: Wire the dashboard — scan action sheet, Réglages link, `receipts` stack layout

**Files:**
- Modify: `mobile/src/presentation/dashboard/household-dashboard.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx`
- Create: `mobile/src/app/(tabs)/receipts/_layout.tsx`

**Interfaces:**
- Consumes: `ActionSheet` (Task 6).
- Produces: `HouseholdDashboardProps` gains `onScanReceipt: () => void` and `onOpenSettings: () => void`.

No new test file for `household-dashboard.tsx` — none exists for this file today (it's exercised visually/manually, same as when the scan FAB was first wired in commit `eb4e7f5`); the behavior it now delegates to (`ActionSheet`) is already fully tested in Task 6.

- [ ] **Step 1: Add the two new props and the action-sheet state**

```tsx
// mobile/src/presentation/dashboard/household-dashboard.tsx
// Add to the imports:
import { ActionSheet } from '../shared/action-sheet.js'

// Extend HouseholdDashboardProps:
export interface HouseholdDashboardProps {
  userName: string
  onSignOut: () => void
  signOutError: string | null
  onOpenRecettes: () => void
  onOpenCourses: () => void
  onOpenFridge: () => void
  onScanProduct: () => void
  onScanReceipt: () => void
  onOpenSettings: () => void
}

// In the component body, destructure the two new props and add:
export function HouseholdDashboard({
  userName,
  onSignOut,
  signOutError,
  onOpenRecettes,
  onOpenCourses,
  onOpenFridge,
  onScanProduct,
  onScanReceipt,
  onOpenSettings,
}: HouseholdDashboardProps) {
  // ...existing hooks...
  const [scanSheetOpen, setScanSheetOpen] = useState(false)

  function openScanSheet() {
    setScanSheetOpen(true)
  }
  function closeScanSheet() {
    setScanSheetOpen(false)
  }
  function handleScanProductChoice() {
    closeScanSheet()
    onScanProduct()
  }
  function handleScanReceiptChoice() {
    closeScanSheet()
    onScanReceipt()
  }
```

- [ ] **Step 2: Point the FAB and Sidebar's scan button at the action sheet instead of `onScanProduct` directly**

```tsx
// Change the FAB's onPress (was onPress={onScanProduct}):
onPress={openScanSheet}

// Change the wide-layout Sidebar's onScan prop (was onScan={onScanProduct}):
onScan={openScanSheet}
```

- [ ] **Step 3: Add the "Réglages" link next to "Se déconnecter", and render the `ActionSheet`**

```tsx
// Directly after the existing sign-out Pressable's closing tag, inside the same YStack:
<Pressable
  onPress={onOpenSettings}
  testID="open-settings"
  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
  accessibilityRole="button"
  accessibilityLabel="Réglages"
  style={pointerCursor}
>
  <Text fontSize={11} fontWeight="500" color={palette.inkSecondary}>
    Réglages
  </Text>
</Pressable>

// At the end of the component's returned JSX tree (sibling to the outermost YStack's content, so it overlays everything):
<ActionSheet
  visible={scanSheetOpen}
  onClose={closeScanSheet}
  options={[
    { testID: 'scan-sheet-product', label: 'Scanner un produit', onPress: handleScanProductChoice },
    { testID: 'scan-sheet-receipt', label: 'Scanner un ticket de caisse', onPress: handleScanReceiptChoice },
  ]}
/>
```

Place the `<ActionSheet .../>` as a sibling right after the component's current outermost return value — since `ActionSheet` renders `null` when `visible` is false, wrapping the existing return in a fragment (`<>...existing tree...<ActionSheet ... /></>`) is the minimal change; check the component's current top-level return shape before editing, since two different top-level branches exist (`isWide` affects inner content, not the outer wrapper) — the wrap only needs to happen once, around whatever that single outer element currently is.

- [ ] **Step 4: Wire the two new callbacks in the route**

```tsx
// mobile/src/app/(tabs)/index.tsx
return (
  <HouseholdDashboard
    userName={session.data?.user.name ?? ''}
    onSignOut={handleSignOut}
    signOutError={error}
    onOpenRecettes={() => router.push('/(tabs)/recipes')}
    onOpenCourses={() => router.push('/(tabs)/shopping-list')}
    onOpenFridge={() => router.push('/(tabs)/fridge')}
    onScanProduct={() => router.push({ pathname: '/(tabs)/fridge/scan', params: { mode: 'create' } })}
    onScanReceipt={() => router.push('/(tabs)/receipts/scan')}
    onOpenSettings={() => router.push('/(tabs)/settings')}
  />
)
```

- [ ] **Step 5: Add the `receipts` stack layout**

```tsx
// mobile/src/app/(tabs)/receipts/_layout.tsx
import { Stack } from 'expo-router'

export default function ReceiptsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
      <Stack.Screen name="review" />
    </Stack>
  )
}
```

- [ ] **Step 6: Typecheck, lint, run the full test suite**

Run: `cd mobile && npx tsc --noEmit && npx eslint . && npx jest`
Expected: no type errors, no lint errors, full suite green.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/presentation/dashboard/household-dashboard.tsx "mobile/src/app/(tabs)/index.tsx" "mobile/src/app/(tabs)/receipts/_layout.tsx"
git commit -m "feat(mobile): wire dashboard scan action sheet and Réglages link"
```

---

## End-of-plan verification

- [ ] Run the full suite once more from a clean state: `cd mobile && npx tsc --noEmit && npx eslint . && npx jest`
- [ ] Confirm every task's checkboxes are ticked.
- [ ] Skim the spec (`docs/superpowers/specs/2026-08-29-mobile-receipt-settings-design.md`) section by section against the eleven feature tasks above to confirm nothing was dropped.
