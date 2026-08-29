# Mobile shopping-list CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire create, edit, and delete for shopping-list items on top of the already-shipped read + toggle-checked screen, closing sub-project 3/4 of the mobile fridge/receipt/settings/shopping-list/recipe work.

**Architecture:** Mirrors the fridge module's CRUD shape end-to-end: domain input types → one `FridgeConnector` method group → `HttpFridgeConnector`/`FakeFridgeConnector` implementations → TanStack Query mutations → a reusable create/edit form screen → a directory-based `expo-router` stack. Delete and edit-entry are exposed via a swipe-to-reveal action pair on `ShoppingRow` (`react-native-gesture-handler`'s `Swipeable`, a dependency already installed but not yet used anywhere in the app — this plan is its first use, so it also wires the one-time `GestureHandlerRootView` root wrapper it requires).

**Tech Stack:** Expo (expo-router), TanStack Query, Tamagui, `react-native-gesture-handler` (`Swipeable`), Jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-08-29-mobile-shopping-list-crud-design.md`

## Global Constraints

- No optimistic UI on any mutation — each mutation awaits the response, then the caller invalidates `['shopping-items']` explicitly (matches the existing `toggleShoppingItem` caller's pattern; the http connector returns a fresh object per fetch, so skipping this shows stale data against a real backend).
- `source` is never a form field — the backend fixes it to `'manual'` for anything created here.
- Swipe-to-delete executes directly, no confirmation dialog (the swipe gesture itself is the deliberate-intent step).
- Editing pre-fills from the already-cached `['shopping-items']` list — no new `GET /api/shopping-items/:id` endpoint exists or is added.
- Recipe (`recipe-list-screen.tsx`) is untouched — out of scope for this plan (sub-project 4/4).
- All new/changed presentation code follows `mobile/DESIGN.md`: lime (`accentLime`/`accentLimeText`) for the one primary action per screen, `expiredBg`/`expiredText` for the one negative/destructive color, no borders (shadow + color contrast only, except the shopping-list card's already-disclosed legal-pad exception), every `Pressable` gets `style={pointerCursor}` and an `accessibilityRole`/`accessibilityLabel`.

---

## Task 1: Domain types — `CreateShoppingItemInput`, `UpdateShoppingItemInput` + `FridgeConnector` interface

**Files:**
- Modify: `mobile/src/domain/shopping-list/shopping-item.ts`
- Modify: `mobile/src/domain/interfaces/fridge-connector.ts`

**Interfaces:**
- Produces: `CreateShoppingItemInput { name: string; quantity: { amount: number; unit: string } }`, `UpdateShoppingItemInput { name?: string; quantity?: { amount: number; unit: string }; checked?: boolean }`, and three `FridgeConnector` methods: `createShoppingItem(input: CreateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>>`, `updateShoppingItem(itemId: string, patch: UpdateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>>`, `deleteShoppingItem(itemId: string): Promise<Result<void, ApiError>>` — `toggleShoppingItem` is removed (superseded by `updateShoppingItem`).

This task only changes the interface/types — no implementation yet, so `tsc` will fail on `HttpFridgeConnector`/`FakeFridgeConnector` not satisfying the interface until Tasks 2–3 land. That's expected; this task's own verification is scoped to the two files it touches.

- [ ] **Step 1: Add the two input types to `shopping-item.ts`**

```ts
/** Structurally identical to the backend's `ShoppingItemDto` (`shopping-item.dto.ts`) — no re-mapping on this side. */
export interface ShoppingItem {
  id: string
  name: string
  quantity: { amount: number; unit: string }
  checked: boolean
  source: string
  createdAt: string
  updatedAt: string
}

/** Mirrors `createShoppingItemValidator` field-for-field. `source` is never client-supplied — the backend fixes it to `'manual'`. */
export interface CreateShoppingItemInput {
  name: string
  quantity: { amount: number; unit: string }
}

/** Mirrors `updateShoppingItemValidator` — any subset of fields, same shape `updateProduct`'s patch already uses. */
export interface UpdateShoppingItemInput {
  name?: string
  quantity?: { amount: number; unit: string }
  checked?: boolean
}
```

- [ ] **Step 2: Update `fridge-connector.ts`'s import and method group**

```ts
// import line: replace
import type { ShoppingItem } from '../shopping-list/shopping-item.js'
// with
import type { ShoppingItem, CreateShoppingItemInput, UpdateShoppingItemInput } from '../shopping-list/shopping-item.js'
```

```ts
// replace this one line:
  toggleShoppingItem(itemId: string, checked: boolean): Promise<Result<ShoppingItem, ApiError>>
// with these three:
  createShoppingItem(input: CreateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>>
  updateShoppingItem(itemId: string, patch: UpdateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>>
  deleteShoppingItem(itemId: string): Promise<Result<void, ApiError>>
```

- [ ] **Step 3: Commit**

```bash
cd mobile
git add src/domain/shopping-list/shopping-item.ts src/domain/interfaces/fridge-connector.ts
git commit -m "feat(mobile): shopping-item create/update/delete domain types + connector interface"
```

---

## Task 2: `HttpFridgeConnector` — implement create/update/delete shopping-item

**Files:**
- Modify: `mobile/src/infrastructure/http/http-fridge-connector.ts`
- Test: `mobile/src/infrastructure/http/http-fridge-connector.test.ts`

**Interfaces:**
- Consumes: `CreateShoppingItemInput`, `UpdateShoppingItemInput` from Task 1.
- Produces: `HttpFridgeConnector.createShoppingItem`, `.updateShoppingItem`, `.deleteShoppingItem` — same method names/signatures as the `FridgeConnector` interface.

- [ ] **Step 1: Write the failing tests**

Add to `http-fridge-connector.test.ts`, near the other `Result`-returning mutation tests (e.g. after the `deleteProduct()` test):

```ts
test('createShoppingItem() posts the JSON payload and unwraps the created item', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 201,
    ok: true,
    json: () =>
      Promise.resolve({
        item: { id: 'new-1', name: 'Farine', quantity: { amount: 1, unit: 'kg' }, checked: false, source: 'manual', createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' },
      }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.createShoppingItem({ name: 'Farine', quantity: { amount: 1, unit: 'kg' } })

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.id).toBe('new-1')
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/shopping-items')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual({ name: 'Farine', quantity: { amount: 1, unit: 'kg' } })

  globalThis.fetch = originalFetch
})

test('updateShoppingItem() PATCHes the patch and returns Result.ok with the updated item', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () =>
      Promise.resolve({
        item: { id: 'fake-item-1', name: 'Lait demi-écrémé', quantity: { amount: 2, unit: 'L' }, checked: true, source: 'manual', createdAt: '2026-08-26T08:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' },
      }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.updateShoppingItem('fake-item-1', { checked: true })

  expect(result).toEqual({
    ok: true,
    value: { id: 'fake-item-1', name: 'Lait demi-écrémé', quantity: { amount: 2, unit: 'L' }, checked: true, source: 'manual', createdAt: '2026-08-26T08:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' },
  })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toContain('/api/shopping-items/fake-item-1')
  expect(init.method).toBe('PATCH')
  expect(JSON.parse(init.body)).toEqual({ checked: true })

  globalThis.fetch = originalFetch
})

test('deleteShoppingItem() maps a 204 response to Result.ok(undefined)', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ status: 204, ok: true }) as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.deleteShoppingItem('fake-item-1')

  expect(result).toEqual({ ok: true, value: undefined })

  globalThis.fetch = originalFetch
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && npx jest http-fridge-connector.test.tsx -t "ShoppingItem"`
Expected: FAIL — `connector.createShoppingItem is not a function` (and similarly for the other two).

- [ ] **Step 3: Implement the three methods, replacing `toggleShoppingItem`**

In `http-fridge-connector.ts`, replace:

```ts
  async toggleShoppingItem(itemId: string, checked: boolean): Promise<Result<ShoppingItem, ApiError>> {
    const result = await apiFetch<{ item: ShoppingItem }>(`/api/shopping-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ checked }),
    })
    return result.ok ? Result.ok(result.value.item) : Result.err(result.error)
  }
```

with:

```ts
  async createShoppingItem(input: CreateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const result = await apiFetch<{ item: ShoppingItem }>('/api/shopping-items', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return result.ok ? Result.ok(result.value.item) : Result.err(result.error)
  }

  async updateShoppingItem(itemId: string, patch: UpdateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const result = await apiFetch<{ item: ShoppingItem }>(`/api/shopping-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    return result.ok ? Result.ok(result.value.item) : Result.err(result.error)
  }

  async deleteShoppingItem(itemId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(`/api/shopping-items/${itemId}`, { method: 'DELETE' })
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }
```

Update the import line for `ShoppingItem`:

```ts
import type { ShoppingItem, CreateShoppingItemInput, UpdateShoppingItemInput } from '../../domain/shopping-list/shopping-item.js'
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile && npx jest http-fridge-connector.test.tsx -t "ShoppingItem"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd mobile
git add src/infrastructure/http/http-fridge-connector.ts src/infrastructure/http/http-fridge-connector.test.ts
git commit -m "feat(mobile): HttpFridgeConnector create/update/delete shopping-item"
```

---

## Task 3: `FakeFridgeConnector` — implement create/update/delete shopping-item

**Files:**
- Modify: `mobile/src/infrastructure/fake/fake-fridge-connector.ts`
- Test: `mobile/src/infrastructure/fake/fake-fridge-connector.test.ts`

**Interfaces:**
- Consumes: `CreateShoppingItemInput`, `UpdateShoppingItemInput` from Task 1.
- Produces: `FakeFridgeConnector.createShoppingItem`, `.updateShoppingItem`, `.deleteShoppingItem` — mutate `this.shoppingItems` in place, same style as `createProduct`/`updateProduct`/`deleteProduct`.

- [ ] **Step 1: Write the failing tests**

Replace the existing `toggleShoppingItem()` tests in `fake-fridge-connector.test.ts` with:

```ts
test('createShoppingItem() adds a new item to the list', async () => {
  const connector = new FakeFridgeConnector()
  const before = await connector.getShoppingItems()

  const result = await connector.createShoppingItem({ name: 'Farine', quantity: { amount: 1, unit: 'kg' } })
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.value.name).toBe('Farine')
    expect(result.value.checked).toBe(false)
    expect(result.value.source).toBe('manual')
  }

  const after = await connector.getShoppingItems()
  expect(after.length).toBe(before.length + 1)
})

test('updateShoppingItem() patches an item and persists across calls', async () => {
  const connector = new FakeFridgeConnector()
  const [first] = await connector.getShoppingItems()
  expect(first.checked).toBe(false)

  const result = await connector.updateShoppingItem(first.id, { checked: true })
  expect(result.ok).toBe(true)

  const [updated] = await connector.getShoppingItems()
  expect(updated.checked).toBe(true)
})

test('updateShoppingItem() rejects an unknown id', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.updateShoppingItem('does-not-exist', { checked: true })
  expect(result.ok).toBe(false)
})

test('deleteShoppingItem() removes the item from the list', async () => {
  const connector = new FakeFridgeConnector()
  const before = await connector.getShoppingItems()
  const [first] = before

  const result = await connector.deleteShoppingItem(first.id)
  expect(result.ok).toBe(true)

  const after = await connector.getShoppingItems()
  expect(after.length).toBe(before.length - 1)
  expect(after.find((i) => i.id === first.id)).toBeUndefined()
})

test('deleteShoppingItem() rejects an unknown id', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.deleteShoppingItem('does-not-exist')
  expect(result.ok).toBe(false)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && npx jest fake-fridge-connector.test.tsx -t "ShoppingItem"`
Expected: FAIL — `connector.createShoppingItem is not a function`.

- [ ] **Step 3: Implement the three methods, replacing `toggleShoppingItem`, and add the id counter**

Add a counter next to the existing `nextProductId`/`nextReceiptId` fields:

```ts
  private nextShoppingItemId = 1
```

Replace:

```ts
  async toggleShoppingItem(itemId: string, checked: boolean): Promise<Result<ShoppingItem, ApiError>> {
    const item = this.shoppingItems.find((i) => i.id === itemId)
    if (!item) return Result.err({ type: 'not_found', message: 'Article introuvable.' })
    item.checked = checked
    item.updatedAt = new Date().toISOString()
    return Result.ok(item)
  }
```

with:

```ts
  async createShoppingItem(input: CreateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const now = new Date().toISOString()
    const item: ShoppingItem = {
      id: `fake-item-new-${this.nextShoppingItemId++}`,
      name: input.name,
      quantity: input.quantity,
      checked: false,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    }
    this.shoppingItems.push(item)
    return Result.ok(item)
  }

  async updateShoppingItem(itemId: string, patch: UpdateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const item = this.shoppingItems.find((i) => i.id === itemId)
    if (!item) return Result.err({ type: 'not_found', message: 'Article introuvable.' })
    Object.assign(item, patch, { updatedAt: new Date().toISOString() })
    return Result.ok(item)
  }

  async deleteShoppingItem(itemId: string): Promise<Result<void, ApiError>> {
    const index = this.shoppingItems.findIndex((i) => i.id === itemId)
    if (index === -1) return Result.err({ type: 'not_found', message: 'Article introuvable.' })
    this.shoppingItems.splice(index, 1)
    return Result.ok(undefined)
  }
```

Update the import line for `ShoppingItem`:

```ts
import type { ShoppingItem, CreateShoppingItemInput, UpdateShoppingItemInput } from '../../domain/shopping-list/shopping-item.js'
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile && npx jest fake-fridge-connector.test.tsx -t "ShoppingItem"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd mobile
git add src/infrastructure/fake/fake-fridge-connector.ts src/infrastructure/fake/fake-fridge-connector.test.ts
git commit -m "feat(mobile): FakeFridgeConnector create/update/delete shopping-item"
```

---

## Task 4: Application mutations — create/update/delete shopping-item

**Files:**
- Create: `mobile/src/application/shopping-list/create-shopping-item.mutation.ts`
- Create: `mobile/src/application/shopping-list/update-shopping-item.mutation.ts`
- Delete: `mobile/src/application/shopping-list/toggle-shopping-item.mutation.ts`
- Create: `mobile/src/application/shopping-list/delete-shopping-item.mutation.ts`
- Modify: `mobile/src/presentation/shopping-list/shopping-list-screen.tsx`

**Interfaces:**
- Consumes: `HttpFridgeConnector`/`FakeFridgeConnector`'s `createShoppingItem`/`updateShoppingItem`/`deleteShoppingItem` from Tasks 2–3; `defineMutation` from `application/shared/define-mutation.js`.
- Produces: `useCreateShoppingItemMutation`, `useUpdateShoppingItemMutation`, `useDeleteShoppingItemMutation` — hooks consumed by Task 5 (form screen) and Task 9 (swipe row wiring).

This task has no new tests of its own (the mutation wrappers are one-line pass-throughs, exercised indirectly by the screen/form tests in Tasks 5 and 9) — it's verified by `shopping-list-screen.tsx` still typechecking and its toggle behavior still working end-to-end.

- [ ] **Step 1: Create the three mutation files**

`create-shopping-item.mutation.ts`:

```ts
import { defineMutation } from '../shared/define-mutation.js'
import type { CreateShoppingItemInput } from '../../domain/shopping-list/shopping-item.js'

export const useCreateShoppingItemMutation = defineMutation((connector, input: CreateShoppingItemInput) =>
  connector.createShoppingItem(input),
)
```

`update-shopping-item.mutation.ts`:

```ts
import { defineMutation } from '../shared/define-mutation.js'
import type { UpdateShoppingItemInput } from '../../domain/shopping-list/shopping-item.js'

export const useUpdateShoppingItemMutation = defineMutation(
  (connector, variables: { itemId: string; patch: UpdateShoppingItemInput }) =>
    connector.updateShoppingItem(variables.itemId, variables.patch),
)
```

`delete-shopping-item.mutation.ts`:

```ts
import { defineMutation } from '../shared/define-mutation.js'

export const useDeleteShoppingItemMutation = defineMutation((connector, itemId: string) =>
  connector.deleteShoppingItem(itemId),
)
```

- [ ] **Step 2: Delete `toggle-shopping-item.mutation.ts`**

```bash
cd mobile && git rm src/application/shopping-list/toggle-shopping-item.mutation.ts
```

- [ ] **Step 3: Update `shopping-list-screen.tsx`'s only caller of the removed toggle mutation**

Replace:

```ts
import { useToggleShoppingItemMutation } from '../../application/shopping-list/toggle-shopping-item.mutation.js'
```

with:

```ts
import { useUpdateShoppingItemMutation } from '../../application/shopping-list/update-shopping-item.mutation.js'
```

Replace:

```ts
  const toggle = useToggleShoppingItemMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-items'] }),
  })
```

with:

```ts
  const updateItem = useUpdateShoppingItemMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-items'] }),
  })
```

Replace:

```ts
  function handleToggle(item: ShoppingItem, next: boolean) {
    toggle.mutate({ itemId: item.id, checked: next })
  }
```

with:

```ts
  function handleToggle(item: ShoppingItem, next: boolean) {
    updateItem.mutate({ itemId: item.id, patch: { checked: next } })
  }
```

- [ ] **Step 4: Typecheck and run the existing shopping-list-related tests**

Run: `cd mobile && npx tsc --noEmit && npx jest fake-fridge-connector http-fridge-connector`
Expected: no type errors, all passing (no `shopping-list-screen.test.tsx` exists yet — Task 9 adds it).

- [ ] **Step 5: Commit**

```bash
cd mobile
git add src/application/shopping-list src/presentation/shopping-list/shopping-list-screen.tsx
git commit -m "feat(mobile): shopping-item create/update/delete mutations, retire toggle mutation"
```

---

## Task 5: `shopping-item-form-screen.tsx` — create + edit

**Files:**
- Create: `mobile/src/presentation/shopping-list/shopping-item-form-screen.tsx`
- Test: `mobile/src/presentation/shopping-list/shopping-item-form-screen.test.tsx`

**Interfaces:**
- Consumes: `FormField` from `presentation/fridge/form-field.js` (reused as-is, not duplicated); `Quantity` VO from `domain/fridge/quantity.js`; `useShoppingItemsQuery` from `application/shopping-list/shopping-items.query.js`; `useCreateShoppingItemMutation`/`useUpdateShoppingItemMutation` from Task 4.
- Produces: `ShoppingItemFormScreen(props: { mode: 'create' } | { mode: 'edit'; itemId: string }, onSuccess?: () => void)` — consumed by Task 6's routes.

- [ ] **Step 1: Write the failing tests**

```ts
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ShoppingItemFormScreen } from './shopping-item-form-screen.js'

function renderWithProviders(children: ReactNode, connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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
  await renderWithProviders(<ShoppingItemFormScreen mode="create" onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('shopping-item-form-name'), 'Farine')
  await fireEvent.changeText(screen.getByTestId('shopping-item-form-amount'), '1')
  await fireEvent.changeText(screen.getByTestId('shopping-item-form-unit'), 'kg')
  await fireEvent.press(screen.getByTestId('shopping-item-form-submit'))

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
})

test('an empty name shows an inline error and does not submit', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<ShoppingItemFormScreen mode="create" onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('shopping-item-form-amount'), '1')
  await fireEvent.changeText(screen.getByTestId('shopping-item-form-unit'), 'kg')
  await fireEvent.press(screen.getByTestId('shopping-item-form-submit'))

  await waitFor(() => expect(screen.getByText('Le nom est requis.')).toBeTruthy())
  expect(onSuccess).not.toHaveBeenCalled()
})

test('an invalid quantity shows an inline error and does not submit', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<ShoppingItemFormScreen mode="create" onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('shopping-item-form-name'), 'Farine')
  await fireEvent.changeText(screen.getByTestId('shopping-item-form-amount'), '0')
  await fireEvent.changeText(screen.getByTestId('shopping-item-form-unit'), 'kg')
  await fireEvent.press(screen.getByTestId('shopping-item-form-submit'))

  await waitFor(() => expect(screen.getByText('La quantité doit être un entier supérieur à 0.')).toBeTruthy())
  expect(onSuccess).not.toHaveBeenCalled()
})

test('edit mode pre-fills the form from the cached shopping-items list', async () => {
  const connector = new FakeFridgeConnector()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Prime the cache the same way the list screen would have already done by the time
  // a user reaches the edit route — the form reads from this cache, it does not fetch by id.
  const items = await connector.getShoppingItems()
  queryClient.setQueryData(['shopping-items'], items)

  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ShoppingItemFormScreen mode="edit" itemId="fake-item-1" onSuccess={jest.fn()} />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByTestId('shopping-item-form-name').props.value).toBe('Lait demi-écrémé'))
  expect(screen.getByTestId('shopping-item-form-amount').props.value).toBe('2')
  expect(screen.getByTestId('shopping-item-form-unit').props.value).toBe('L')
})

test('submitting an edit form calls updateShoppingItem with the patched fields', async () => {
  const connector = new FakeFridgeConnector()
  const updateSpy = jest.spyOn(connector, 'updateShoppingItem')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const items = await connector.getShoppingItems()
  queryClient.setQueryData(['shopping-items'], items)
  const onSuccess = jest.fn()

  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ShoppingItemFormScreen mode="edit" itemId="fake-item-1" onSuccess={onSuccess} />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByTestId('shopping-item-form-name').props.value).toBe('Lait demi-écrémé'))
  await fireEvent.changeText(screen.getByTestId('shopping-item-form-amount'), '3')
  await fireEvent.press(screen.getByTestId('shopping-item-form-submit'))

  await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1))
  expect(updateSpy).toHaveBeenCalledWith('fake-item-1', { name: 'Lait demi-écrémé', quantity: { amount: 3, unit: 'L' } })
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && npx jest shopping-item-form-screen`
Expected: FAIL — module not found (`ShoppingItemFormScreen` doesn't exist yet).

- [ ] **Step 3: Implement `shopping-item-form-screen.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { FormField } from '../fridge/form-field.js'
import { useShoppingItemsQuery } from '../../application/shopping-list/shopping-items.query.js'
import { useCreateShoppingItemMutation } from '../../application/shopping-list/create-shopping-item.mutation.js'
import { useUpdateShoppingItemMutation } from '../../application/shopping-list/update-shopping-item.mutation.js'
import { Quantity } from '../../domain/fridge/quantity.js'

type ShoppingItemFormMode = { mode: 'create' } | { mode: 'edit'; itemId: string }

export function ShoppingItemFormScreen(props: ShoppingItemFormMode & { onSuccess?: () => void }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  // No per-id fetch exists for shopping items — the list is already cached by the
  // time a user reaches an edit route from the list screen, so edit mode reads
  // from that cache instead of adding a `GET /api/shopping-items/:id` this
  // backend doesn't have.
  const itemsQuery = useShoppingItemsQuery()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const [error, setError] = useState<string | null>(null)

  const appliedEditPrefillRef = useRef(false)

  useEffect(() => {
    if (props.mode !== 'edit' || appliedEditPrefillRef.current) return
    const existing = itemsQuery.data?.find((i) => i.id === props.itemId)
    if (!existing) return
    appliedEditPrefillRef.current = true
    setName(existing.name)
    setAmount(String(existing.quantity.amount))
    setUnit(existing.quantity.unit)
  }, [props, itemsQuery.data])

  const createItem = useCreateShoppingItemMutation()
  const updateItem = useUpdateShoppingItemMutation()
  const pending = createItem.isPending || updateItem.isPending

  async function handleSubmit() {
    setError(null)
    if (name.trim().length === 0) {
      setError('Le nom est requis.')
      return
    }
    const quantity = Quantity.create(Number(amount), unit)
    if (!quantity.ok) {
      setError(quantity.error.message)
      return
    }

    const payload = { name: name.trim(), quantity: quantity.value }

    const result =
      props.mode === 'create'
        ? await createItem.mutateAsync(payload)
        : await updateItem.mutateAsync({ itemId: props.itemId, patch: payload })

    if (!result.ok) {
      setError(result.error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['shopping-items'] })

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
          {props.mode === 'create' ? 'Ajouter un article' : "Modifier l'article"}
        </Text>

        <FormField testID="shopping-item-form-name" label="Nom" value={name} onChangeText={setName} color={palette.ink} />
        <FormField testID="shopping-item-form-amount" label="Quantité" value={amount} onChangeText={setAmount} color={palette.ink} />
        <FormField testID="shopping-item-form-unit" label="Unité" value={unit} onChangeText={setUnit} color={palette.ink} />

        {error ? (
          <Text fontSize={13} color={palette.expiredText}>
            {error}
          </Text>
        ) : null}

        <Pressable
          testID="shopping-item-form-submit"
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile && npx jest shopping-item-form-screen`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd mobile
git add src/presentation/shopping-list/shopping-item-form-screen.tsx src/presentation/shopping-list/shopping-item-form-screen.test.tsx
git commit -m "feat(mobile): shopping-item-form-screen (create + edit)"
```

---

## Task 6: Routes — `shopping-list.tsx` becomes a stack (`index`, `new`, `[id]/edit`)

**Files:**
- Delete: `mobile/src/app/(tabs)/shopping-list.tsx`
- Create: `mobile/src/app/(tabs)/shopping-list/_layout.tsx`
- Create: `mobile/src/app/(tabs)/shopping-list/index.tsx`
- Create: `mobile/src/app/(tabs)/shopping-list/new.tsx`
- Create: `mobile/src/app/(tabs)/shopping-list/[id]/edit.tsx`

**Interfaces:**
- Consumes: `ShoppingListScreen` (existing, unchanged export) from `presentation/shopping-list/shopping-list-screen.js`; `ShoppingItemFormScreen` from Task 5.
- Produces: routes `/(tabs)/shopping-list` (unchanged path — `index.tsx` under a folder resolves to the same route as the former flat file), `/(tabs)/shopping-list/new`, `/(tabs)/shopping-list/[id]/edit` — consumed by Task 7 (add pill) and Task 9 (swipe-to-edit).

Mirrors `app/(tabs)/fridge/`'s exact structure (`_layout.tsx`, `index.tsx`, `new.tsx`, `[id]/edit.tsx`). No test file — routing is verified by Task 9's screen-level navigation assertions and by `npx tsc`/the app boot.

- [ ] **Step 1: Delete the flat file and create the folder's files**

```bash
cd mobile
git mv "src/app/(tabs)/shopping-list.tsx" "src/app/(tabs)/shopping-list/index.tsx"
```

(`git mv` into a not-yet-existing directory creates it — this preserves file history instead of a delete+create pair.)

`src/app/(tabs)/shopping-list/_layout.tsx`:

```tsx
import { Stack } from 'expo-router'

export default function ShoppingListLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]/edit" />
    </Stack>
  )
}
```

`src/app/(tabs)/shopping-list/new.tsx`:

```tsx
import { ShoppingItemFormScreen } from '../../../presentation/shopping-list/shopping-item-form-screen.js'

export default function ShoppingListNewRoute() {
  return <ShoppingItemFormScreen mode="create" />
}
```

`src/app/(tabs)/shopping-list/[id]/edit.tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router'
import { ShoppingItemFormScreen } from '../../../../presentation/shopping-list/shopping-item-form-screen.js'

export default function ShoppingListEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ShoppingItemFormScreen mode="edit" itemId={id} />
}
```

- [ ] **Step 2: Fix `index.tsx`'s relative import depth**

The moved file's import of `ShoppingListScreen` still reads `'../../presentation/shopping-list/shopping-list-screen.js'` (correct for the old flat-file depth: `app/(tabs)/shopping-list.tsx` → `../../presentation`). One directory deeper now, so it must become `'../../../presentation/shopping-list/shopping-list-screen.js'`. Open `src/app/(tabs)/shopping-list/index.tsx` and update that one import line.

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors (in particular, no "Cannot find module" on the moved file's import).

- [ ] **Step 4: Commit**

```bash
cd mobile
git add "src/app/(tabs)/shopping-list"
git commit -m "feat(mobile): shopping-list route stack (index, new, [id]/edit)"
```

---

## Task 7: Root layout — wrap in `GestureHandlerRootView`

**Files:**
- Modify: `mobile/src/app/_layout.tsx`

**Interfaces:**
- Consumes: `GestureHandlerRootView` from `react-native-gesture-handler` (dependency already installed, `~2.32.0`).
- Produces: nothing new consumed by name — this is a required one-time wrapper for `Swipeable` (Task 9) to receive gesture events at all; without it, `Swipeable` mounts but never responds to touches.

- [ ] **Step 1: Wrap the root `Slot` in `GestureHandlerRootView`**

```tsx
import { Slot } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ThemeProvider } from '../presentation/shared/theme-provider.js'
import { ConnectorProvider } from '../application/shared/connector-context.js'
import { createConnector } from '../../providers/create-connector.js'

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient())
  const [connector] = useState(() => createConnector())

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ConnectorProvider connector={connector}>
            <Slot />
          </ConnectorProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

Run: `cd mobile && npx jest`
Expected: PASS — every existing test still renders (this wrapper is transparent to any screen not yet using gesture-handler internals).

- [ ] **Step 3: Commit**

```bash
cd mobile
git add src/app/_layout.tsx
git commit -m "feat(mobile): wrap root layout in GestureHandlerRootView"
```

---

## Task 8: "+ Ajouter" entry point on `shopping-list-screen.tsx`

**Files:**
- Modify: `mobile/src/presentation/shopping-list/shopping-list-screen.tsx`

**Interfaces:**
- Consumes: `router` from `expo-router`, `/(tabs)/shopping-list/new` route from Task 6.
- Produces: a `testID="shopping-list-add"` pressable pill, consumed by this task's own test only.

Deviates from the design spec's literal "floating FAB" wording in one implementation detail: this app's actual established add-entry-point convention (`fridge-list-screen.tsx`'s `+ Ajouter` header pill, `testID="fridge-add"`) is a lighter-weight, already-proven component than the dashboard's bespoke animated floating FAB — reusing it keeps this task small and consistent instead of introducing a second floating-FAB implementation for one screen. Same intent (lime, opens the create form), different established shape.

- [ ] **Step 1: Write the failing test**

Create `mobile/src/presentation/shopping-list/shopping-list-screen.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ShoppingListScreen } from './shopping-list-screen.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}))

function renderScreen(connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ShoppingListScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

afterEach(() => jest.clearAllMocks())

test('tapping "+ Ajouter" navigates to the new-item route', async () => {
  await renderScreen()
  await fireEvent.press(screen.getByTestId('shopping-list-add'))
  expect(router.push).toHaveBeenCalledWith('/(tabs)/shopping-list/new')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest shopping-list-screen`
Expected: FAIL — `Unable to find an element with testID: shopping-list-add`.

- [ ] **Step 3: Add the pill to `ShoppingListContent`'s header row**

In `shopping-list-screen.tsx`, the header is currently:

```tsx
          <XStack alignItems="center" gap="$3">
            {isWide ? null : <BackButton onPress={() => router.back()} ink={palette.ink} cream={palette.cream} />}
            <YStack>
              <Text fontSize={20} fontWeight="800" color={palette.ink}>
                Liste de courses
              </Text>
              <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} marginTop="$0.5">
                {itemsQuery.isPending
                  ? 'Chargement...'
                  : `${unchecked.length} article${unchecked.length > 1 ? 's' : ''} restant${unchecked.length > 1 ? 's' : ''}`}
              </Text>
            </YStack>
          </XStack>
```

Replace it with (adds `justifyContent="space-between"` and the pill, imports `Pressable` from `react-native` and `pointerCursor` from `../shared/hover.js`):

```tsx
          <XStack alignItems="center" justifyContent="space-between" gap="$3">
            <XStack alignItems="center" gap="$3">
              {isWide ? null : <BackButton onPress={() => router.back()} ink={palette.ink} cream={palette.cream} />}
              <YStack>
                <Text fontSize={20} fontWeight="800" color={palette.ink}>
                  Liste de courses
                </Text>
                <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} marginTop="$0.5">
                  {itemsQuery.isPending
                    ? 'Chargement...'
                    : `${unchecked.length} article${unchecked.length > 1 ? 's' : ''} restant${unchecked.length > 1 ? 's' : ''}`}
                </Text>
              </YStack>
            </XStack>
            <Pressable
              testID="shopping-list-add"
              onPress={() => router.push('/(tabs)/shopping-list/new')}
              accessibilityRole="button"
              accessibilityLabel="Ajouter un article"
              style={pointerCursor}
            >
              <XStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$1.5" paddingHorizontal="$3">
                <Text fontSize={13} fontWeight="800" color={palette.accentLimeText}>
                  + Ajouter
                </Text>
              </XStack>
            </Pressable>
          </XStack>
```

Add the two new imports at the top of the file:

```ts
import { Pressable } from 'react-native'
import { pointerCursor } from '../shared/hover.js'
```

(`Pressable` may need merging into the existing `react-native` import line if `ScrollView`/`useWindowDimensions` are already imported from there — check the current import line and combine into one `import { Pressable, ScrollView, useWindowDimensions } from 'react-native'` rather than adding a second line for the same module.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile && npx jest shopping-list-screen`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd mobile
git add src/presentation/shopping-list/shopping-list-screen.tsx src/presentation/shopping-list/shopping-list-screen.test.tsx
git commit -m "feat(mobile): + Ajouter entry point on shopping-list-screen"
```

---

## Task 9: `ShoppingRow` swipe actions — edit + delete

**Files:**
- Modify: `mobile/src/presentation/shopping-list/shopping-row.tsx`
- Modify: `mobile/src/presentation/shopping-list/shopping-list-screen.tsx`
- Modify: `mobile/src/presentation/shopping-list/shopping-list-screen.test.tsx`

**Interfaces:**
- Consumes: `Swipeable` from `react-native-gesture-handler`; `useDeleteShoppingItemMutation` from Task 4; `useHint`/`HintBubble` from `presentation/shared/hint-bubble.js`; `router` for the edit navigation.
- Produces: `ShoppingRow` gains two new required props, `onEdit: () => void` and `onDelete: () => void` — both callers (`ShoppingListContent`'s two `.map()` calls, for unchecked and checked rows) must pass them.

- [ ] **Step 1: Write the failing tests**

Add to `shopping-list-screen.test.tsx`:

```tsx
test('swiping and tapping "Modifier" navigates to the item\'s edit route', async () => {
  await renderScreen()
  const editButtons = await screen.findAllByTestId(/^shopping-row-edit-/)
  await fireEvent.press(editButtons[0])
  expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(tabs)/shopping-list/[id]/edit' }))
})

test('swiping and tapping "Supprimer" deletes the item and refreshes the list', async () => {
  const connector = new FakeFridgeConnector()
  const deleteSpy = jest.spyOn(connector, 'deleteShoppingItem')
  await renderScreen(connector)

  const before = await screen.findAllByTestId(/^shopping-row-delete-/)
  const targetTestId = before[0].props.testID as string
  await fireEvent.press(before[0])

  await waitFor(() => expect(deleteSpy).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.queryByTestId(targetTestId)).toBeNull())
})

test('a failed delete shows a hint instead of removing the row', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'deleteShoppingItem').mockResolvedValue({ ok: false, error: { type: 'server_error', message: 'Suppression impossible.' } })
  await renderScreen(connector)

  const deleteButtons = await screen.findAllByTestId(/^shopping-row-delete-/)
  await fireEvent.press(deleteButtons[0])

  await waitFor(() => expect(screen.getByText('Suppression impossible.')).toBeTruthy())
})
```

Add `waitFor` to the existing `@testing-library/react-native` import line in the test file (currently `{ render, screen, fireEvent }` → `{ render, screen, fireEvent, waitFor }`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && npx jest shopping-list-screen`
Expected: FAIL — no elements matching `shopping-row-edit-`/`shopping-row-delete-` exist yet.

- [ ] **Step 3: Give `ShoppingRow` its swipe actions**

Replace `shopping-row.tsx` in full:

```tsx
import { Animated, Pressable } from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { HandDrawnCheck } from './hand-drawn-check.js'
import { CheckedName } from './checked-name.js'
import { useQuietRowFeedback } from './use-quiet-row-feedback.js'
import type { ShoppingItem } from '../../domain/shopping-list/shopping-item.js'

export function ShoppingRow({
  item,
  onToggle,
  onEdit,
  onDelete,
  isLast,
}: {
  item: ShoppingItem
  onToggle: (checked: boolean) => void
  onEdit: () => void
  onDelete: () => void
  isLast: boolean
}) {
  const palette = useSoftPalette()
  const row = useQuietRowFeedback()
  return (
    <Swipeable
      renderRightActions={() => (
        <XStack>
          <Pressable
            testID={`shopping-row-edit-${item.id}`}
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`Modifier ${item.name}`}
            style={pointerCursor}
          >
            <YStack backgroundColor={palette.mintPale} alignItems="center" justifyContent="center" width={72} height="100%">
              <Text fontSize={12} fontWeight="700" color={palette.mintPaleText}>
                Modifier
              </Text>
            </YStack>
          </Pressable>
          <Pressable
            testID={`shopping-row-delete-${item.id}`}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`Supprimer ${item.name}`}
            style={pointerCursor}
          >
            <YStack backgroundColor={palette.expiredBg} alignItems="center" justifyContent="center" width={72} height="100%">
              <Text fontSize={12} fontWeight="700" color={palette.expiredText}>
                Supprimer
              </Text>
            </YStack>
          </Pressable>
        </XStack>
      )}
    >
      <Pressable
        onPress={() => onToggle(!item.checked)}
        onHoverIn={row.onHoverIn}
        onHoverOut={row.onHoverOut}
        onPressIn={row.pressIn}
        onPressOut={row.pressOut}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={`${item.name}, ${item.quantity.amount} ${item.quantity.unit}`}
        style={pointerCursor}
      >
        <Animated.View
          style={{
            opacity: row.opacity,
            backgroundColor: row.hovered ? palette.layoutSurface : 'transparent',
            borderRadius: 10,
          }}
        >
          <XStack
            alignItems="center"
            gap="$3"
            paddingVertical="$2.5"
            paddingHorizontal="$2"
            minHeight={48}
            style={!isLast ? { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: palette.paperRule } : undefined}
          >
            <YStack
              width={24}
              height={24}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor={item.checked ? palette.freshBg : 'transparent'}
              style={{ borderWidth: item.checked ? 0 : 2.5, borderColor: palette.inkSecondary }}
            >
              {item.checked ? <HandDrawnCheck size={15} color={palette.freshText} /> : null}
            </YStack>
            <YStack flex={1}>
              {item.checked ? (
                <CheckedName color={palette.penMark}>{item.name}</CheckedName>
              ) : (
                <Text fontSize={14} fontWeight="700" color={palette.ink}>
                  {item.name}
                </Text>
              )}
              <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} marginTop="$0.5">
                {item.quantity.amount} {item.quantity.unit}
              </Text>
            </YStack>
          </XStack>
        </Animated.View>
      </Pressable>
    </Swipeable>
  )
}
```

- [ ] **Step 4: Wire `onEdit`/`onDelete` in `shopping-list-screen.tsx`**

Add the new imports:

```ts
import { useDeleteShoppingItemMutation } from '../../application/shopping-list/delete-shopping-item.mutation.js'
import { HintBubble, useHint } from '../shared/hint-bubble.js'
```

Inside `ShoppingListContent`, add hint state and the delete mutation next to `updateItem`:

```ts
  const [hint, showHint] = useHint()
  const deleteItem = useDeleteShoppingItemMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-items'] }),
  })

  function handleEdit(item: ShoppingItem) {
    router.push({ pathname: '/(tabs)/shopping-list/[id]/edit', params: { id: item.id } })
  }

  async function handleDelete(item: ShoppingItem) {
    const result = await deleteItem.mutateAsync(item.id)
    if (!result.ok) showHint(result.error.message)
  }
```

Pass the two new props on both `ShoppingRow` usages (the `unchecked.map` and `checked.map` blocks):

```tsx
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    isLast={index === unchecked.length - 1}
                    onToggle={(next) => handleToggle(item, next)}
                    onEdit={() => handleEdit(item)}
                    onDelete={() => handleDelete(item)}
                  />
```

(same three new props on the `checked.map` block's `ShoppingRow`).

Render `HintBubble` at the end of `ShoppingListContent`'s returned tree (it renders `null` when `hint` is `null`, so this is always safe to mount) — add it as the last child inside the outermost `YStack`, after the closing `</SafeAreaView>`:

```tsx
      <HintBubble hint={hint} palette={palette} />
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd mobile && npx jest shopping-list-screen`
Expected: PASS (all shopping-list-screen tests, including the three new ones).

- [ ] **Step 6: Commit**

```bash
cd mobile
git add src/presentation/shopping-list/shopping-row.tsx src/presentation/shopping-list/shopping-list-screen.tsx src/presentation/shopping-list/shopping-list-screen.test.tsx
git commit -m "feat(mobile): shopping-row swipe actions (edit navigate + delete)"
```

---

## Task 10: End-of-plan verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full suite from a clean state**

Run: `cd mobile && npx tsc --noEmit && npx eslint . && npx jest`
Expected: no type errors, no new lint errors (pre-existing 2 warnings in `result.ts`/`tamagui.config.ts` are out of scope), full suite green.

- [ ] **Step 2: Confirm every task's checkboxes are ticked.**

- [ ] **Step 3: Skim the spec (`docs/superpowers/specs/2026-08-29-mobile-shopping-list-crud-design.md`) section by section against the nine feature tasks above (Tasks 1–9) to confirm nothing was dropped** — in particular §4 (error/empty states, already covered by the existing empty-state block plus Task 9's delete-failure hint) and §5 (test coverage per file, cross-check against the tests actually added in Tasks 2, 3, 5, 8, 9).

- [ ] **Step 4: Manually confirm no remaining reference to `toggleShoppingItem` or `useToggleShoppingItemMutation` anywhere in `mobile/src`**

Run: `cd mobile && grep -rn "toggleShoppingItem\|useToggleShoppingItemMutation" src`
Expected: no output.
