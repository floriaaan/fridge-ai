# Mobile Receipt Scan + Settings — Design

**Sub-project:** 2/3 of the mobile fridge/receipt/settings work (1/3 — fridge
inventory — shipped; recipe/shopping-list screens for phase 3 also already
shipped ahead of this). This sub-project covers the two remaining screens
whose backend endpoints exist but have no mobile client: receipt scanning
(`/api/receipts/*`) and AI provider settings (`/api/settings/ai`).

## Goal

Let a household member (1) photograph or pick a grocery receipt, have it
extracted by whatever AI provider the household has configured, review and
correct the extracted items, and import them as fridge products in one
flow; and (2) see and switch which AI provider (`gemini` / `openai` /
`ollama`) is active, among the ones the backend reports as configured.

## Global Constraints

Same conventions as every prior mobile phase (see
`docs/superpowers/plans/2026-08-28-mobile-fridge-inventory.md`'s Global
Constraints — layered structure, `Result<T, ApiError>` for mutations,
`.js` extensions in relative imports, French UI strings). Additionally:

- `ReceiptDraftDto`/`ImportReceipt` field names are structurally identical
  to `backend/src/presentation/receipt/receipt.dto.ts` and
  `receipt.validator.ts` — no re-mapping.
- `AiSettingsDto` mirrors `backend/src/presentation/settings/ai-settings.dto.ts`
  (`EffectiveAiSettings`) field-for-field.
- The backend never sets a non-null `imageKey` on import in this phase (its
  controller comment: "no phase-2 write path exists yet"). `GET
  /receipts/:id/image` is therefore not consumed by mobile — same treatment
  `imageUrl`/image upload got in the fridge inventory phase: documented,
  deliberately skipped, not half-wired.
- No receipt image is attached client-side either — `POST /receipts/scan`
  and `/receipts/import` only ever send the photo for extraction, never
  persist it (matches the backend's actual write path).

## Out of scope

- Editing or deleting a saved receipt.
- Any change to `AI_PROVIDER`/API keys themselves (server-side config only;
  the settings screen only picks among providers the backend already
  reports as `availableProviders`).
- Receipt image display anywhere (see constraint above).

## Data flow

### Receipt scan → review → import

1. `receipts/scan` screen: camera (reusing `barcode-scanner-screen`'s
   `expo-camera` pattern, permission gate included) plus a "Choisir dans la
   galerie" button (new dependency: `expo-image-picker`). Either path ends
   with one local image URI.
2. That URI is read into a `Blob`/`FormData` and sent via
   `FridgeConnector.scanReceipt(imageUri)` → `POST /receipts/scan`
   (multipart, field `image`) → `Result<ReceiptDraft, ApiError>`.
3. On success, navigate to `receipts/review`, passing the draft through
   `expo-router` params (small payload — store name, date, total, ≤ a few
   dozen items — serialized as a JSON string param, same technique already
   used for `prefillBarcode`).
4. `receipts/review` renders an editable form: `storeName` (text),
   `scannedAt` (date, defaults to draft value), `totalAmount` (read-only,
   computed by backend — not user-editable, since it's the receipt total,
   not a sum of the editable item list), and one editable row per item:
   name, quantity, unit, category (optional), price (optional), plus two
   fields the draft never carries because the backend requires them only at
   import time: `location` (segmented control `fridge`/`freezer`/`pantry`,
   defaults to `fridge`) and `expiresAt` (optional date).
5. "Importer" calls `FridgeConnector.importReceipt(input)` → `POST
   /receipts/import` → `Result<{ receipt, products }, ApiError>`. On
   success: invalidate the fridge products query (new products must appear
   in `fridge-list-screen`/dashboard immediately), show a success toast,
   navigate back to the dashboard.
6. On a `scan` failure (`extraction_failed`): inline message "Extraction
   impossible, réessaie ou vérifie ta photo" + retry button back on the
   scan screen. No manual-entry fallback in this phase — retry only.
7. On an `import` failure (validation, e.g. an item missing `location`):
   inline per-field errors on `receipts/review`, same pattern as
   `fridge-form-screen`'s `FormField` error display.

### Settings

`settings` screen: `FridgeConnector.getAiSettings()` (`GET
/api/settings/ai`) renders a radio list of `availableProviders`, the
`activeProvider` pre-selected, and a small caption below showing `source`
(`"Configuré par l'administrateur"` for `environment`, `"Choisi par le
foyer"` for `database`). Tapping an unselected provider calls
`FridgeConnector.setActiveAiProvider(provider)` (`PATCH
/api/settings/ai`) optimistically (TanStack `useMutation` with
`onMutate`/`onError` rollback, same optimistic-toggle pattern as
`toggleShoppingItem`).

### Receipt history

A "Historique des tickets" row inside the `settings` screen (not a
dashboard NavCard — secondary/infrequent action) opens `receipts-list`:
`FridgeConnector.getReceipts()` (`GET /receipts`) → cards showing
`storeName`, `scannedAt`, `totalAmount`, `itemsCount`. Tapping a card opens
`receipts/[id]`: `FridgeConnector.getReceipt(id)` (`GET /receipts/:id`) →
receipt header + the list of products it produced (read-only product
cards, reusing `fridge-list-screen`'s product row rendering where
practical).

## Navigation

- Dashboard FAB currently jumps straight to the barcode scanner. It
  becomes a small two-option action sheet (new Tamagui component, no new
  library — matches the app's existing custom-component approach rather
  than a platform-specific `ActionSheetIOS`): **"Scanner un produit"**
  (existing behavior, barcode) and **"Scanner un ticket de caisse"** (new,
  → `receipts/scan`).
- A new gear icon sits in the dashboard header next to the existing
  sign-out link → `settings`.
- Routes added under `app/(tabs)/`: `receipts/scan.tsx`,
  `receipts/review.tsx`, `receipts/index.tsx` (list), `receipts/[id].tsx`
  (detail), `settings.tsx`. All still reachable only through the entry
  points above — the tab bar itself stays hidden (`tabBarStyle: { display:
  'none' }`), unchanged from every prior phase.

## `FridgeConnector` extension

```ts
export interface ReceiptDraft {
  storeName: string
  scannedAt: string
  totalAmount: number
  items: {
    name: string
    quantity: number
    unit: string
    category: string | null
    price: number | null
  }[]
}

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

export interface Receipt {
  id: string
  storeName: string
  scannedAt: string
  totalAmount: number
  imageKey: string | null
  itemsCount: number
  createdAt: string
}

export interface AiSettings {
  activeProvider: 'gemini' | 'openai' | 'ollama'
  source: 'database' | 'environment'
  availableProviders: ('gemini' | 'openai' | 'ollama')[]
}

// Added to FridgeConnector:
scanReceipt(imageUri: string): Promise<Result<ReceiptDraft, ApiError>>
importReceipt(input: ImportReceiptInput): Promise<Result<{ receipt: Receipt; products: Product[] }, ApiError>>
getReceipts(): Promise<Receipt[]>
getReceipt(receiptId: string): Promise<{ receipt: Receipt; products: Product[] } | null>
getAiSettings(): Promise<AiSettings>
setActiveAiProvider(provider: AiSettings['activeProvider']): Promise<Result<AiSettings, ApiError>>
```

Implemented on both `HttpFridgeConnector` (real `apiFetch` calls, plus one
raw `fetch`/`FormData` multipart call for `scanReceipt` since `apiFetch`
assumes JSON bodies) and `FakeFridgeConnector` (in-memory, new fixtures
under `infrastructure/fake/fixtures/`).

## Testing

Same TDD pattern as every prior phase: a failing unit test for each new
domain/application piece, `*.test.tsx` per screen driven through
`FakeFridgeConnector`, `apiFetch`/multipart behavior covered at the
`http-fridge-connector` level. `receipts/review`'s per-item edit state is
the one genuinely new piece of UI logic (add/remove is not needed — the
item list is fixed by the draft, only field values change) and gets
focused unit coverage on its validation (each item needs a `location`
before import is enabled).

## Dependencies

- `expo-image-picker` (new) — gallery picker for `receipts/scan`. Added to
  `app.json`'s `plugins` array with a `photosPermission` string, same
  shape as the existing `expo-camera` entry.
