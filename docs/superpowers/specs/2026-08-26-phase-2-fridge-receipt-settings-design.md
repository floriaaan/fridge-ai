# Phase 2 — Fridge, Receipt, Settings (AI provider) Design

**Status:** approved, ready for implementation planning.

**Goal:** ship the next independently-testable backend slice on top of Phase 1
(identity/household): the `fridge` (Product), `receipt` (scan → import), and
`settings` (AI provider, instance-wide) bounded contexts. Every `fridge`/`receipt`
resource is scoped by `householdId` (never `userId`) via the existing
`household_required_middleware`. No `shopping-list`/`recipe` modules yet — those
remain later phases. No fridge-scan/statistics/HA integration (ADR-0010, explicitly
post-MVP).

**Spec (authoritative, this document does not duplicate it):**
- `docs/phase-0/02-modele-de-domaine.md` — `fridge`, `receipt`, `settings` sections:
  entities, value objects, ports, invariants.
- `docs/phase-0/03-schema-base-de-donnees.md` — `product`, `receipt`,
  `ai_provider_setting` tables (the last one already migrated in Phase 1 Task 5,
  unused until now).
- `docs/phase-0/04-endpoints-http.md` — `fridge`, `receipt` endpoint sections
  (request/response shapes, status codes). `settings` endpoints are specified in
  ADR-0007 instead (not yet in `04-endpoints-http.md` — the implementation plan
  should add them there as part of Task 1).
- ADR-0006 (extraction IA multimodale, pas d'OCR séparé), ADR-0007 (provider IA
  changeable à chaud), ADR-0008 (code-barres côté app, lookup OFF backend seul),
  ADR-0009 (images via routes authentifiées), ADR-0010 (scope post-MVP non
  pré-câblé).

**Why this document exists at all:** the phase-0 docs fully specify the domain
model, schema, and HTTP contracts already — this design only covers what they
*don't*: the concrete architecture for the pieces that are new relative to Phase 1
(a cross-cutting file storage port, a hot-reloadable AI-provider registry, three
real vision adapters, an external product-lookup adapter), how they compose, and
the task sequencing to build them safely.

---

## 1. Bounded contexts and build order

Three contexts, built in dependency order (a context is only built once what it
needs already exists):

1. **`settings`** — first. `receipt`'s extraction depends on it; nothing here
   depends on `fridge`/`receipt`. Not scoped by `householdId` (the one exception,
   cf. ADR-0007) — it's an instance-wide setting, gated to household owners for
   writes, readable by any authenticated session.
2. **`fridge`** — second. No dependency on `receipt` (the reverse dependency exists:
   `Product.receiptId` is an optional FK set by `receipt`'s import use-case, not a
   call from `fridge` into `receipt`). Depends on `settings` for nothing — it has
   its own external adapter (OpenFoodFacts) unrelated to the AI provider.
3. **`receipt`** — last. Depends on `settings` (via `ai-provider-registry`) for
   extraction, and writes into `fridge` (creates `Product` rows) on import — but
   only through `ProductRepository`, never a direct cross-aggregate method call
   (cf. the "no inverse dependency" rule in `02-modele-de-domaine.md`'s diagram).

## 2. New infrastructure: `StorageService`

Cross-cutting, owned by neither `fridge` nor `receipt` — both need it for
`imageKey`. Lives in `#domain/shared/interfaces/storage.interface.ts` (port) with
one Phase 2 implementation.

```ts
// domain/shared/interfaces/storage.interface.ts
export interface StorageService {
  save(key: string, buffer: Buffer, contentType: string): Promise<void>
  read(key: string): Promise<{ buffer: Buffer; contentType: string } | null>
  delete(key: string): Promise<void>
}
```

**`LocalFilesystemStorage`** (`src/infrastructure/storage/local-filesystem-storage.ts`)
— the only implementation this phase builds (S3/minio explicitly deferred, per the
brainstorming decision — the port is the seam, not built yet). Writes under
`STORAGE_ROOT` (new env var, default `./data/storage`, gitignored — mirrors the
existing `data/` entry Phase 1 already added for the Postgres volume). `key` is an
opaque relative path the domain never interprets (`receipts/<uuid>.jpg`,
`products/<uuid>.jpg`) — matches `imageKey`'s contract in
`02-modele-de-domaine.md` ("clé de stockage opaque, jamais une URL publique").

Controllers generate the key at write time. This phase, that only happens for
`receipt.imageKey` (the scanned ticket photo, saved on `POST /api/receipts/import`)
— `04-endpoints-http.md`'s product section has no dedicated image-upload endpoint,
so `product.imageKey` stays `null` for every product created this phase (both
manually and via receipt import; `Product` doesn't inherit the receipt's photo).
`GET /api/products/:id/image` is still built now — same route shape as the receipt
one, `404 image_not_found` whenever the key is null — so a later phase can start
writing that key without touching this route. Every image route
(`GET /api/receipts/:id/image`, `GET /api/products/:id/image`) checks the parent
resource belongs to the caller's household — same guard as every other endpoint on
that resource, not a separate authorization path (ADR-0009) — then streams via
`StorageService.read()`, `404` if the key is null or the file is missing.

## 3. New infrastructure: AI provider registry + adapters

**`AiSettingsProvider`** (`#domain/settings/interfaces/ai-settings-provider.interface.ts`,
port) — `resolveEffective(): Promise<EffectiveAiSettings>`. Implementation
(`EnvAiSettingsProvider` or similar, infra) reads `AiProviderSettingsRepository.find()`
(the DB row, if any) and falls back to `AI_PROVIDER` env; computes
`availableProviders` from which of `GEMINI_API_KEY`/`OPENAI_API_KEY`/
`OLLAMA_BASE_URL` are actually set.

**`AiProviderRegistry`** (`src/infrastructure/settings/ai-provider-registry.ts`) —
resolves the live `ReceiptExtractionPort`, with cache invalidation on settings
change. Pattern reused verbatim from `arr`'s `getAuthInstance`
(`~/dev/arr/backend/src/infrastructure/auth/better-auth/instance.ts:163-181`):

```ts
let cached: { adapter: ReceiptExtractionPort; signature: string } | null = null

export async function resolveReceiptExtractionAdapter(
  settings: AiSettingsProvider,
): Promise<ReceiptExtractionPort> {
  const effective = await settings.resolveEffective()
  const signature = effective.activeProvider
  if (!cached || cached.signature !== signature) {
    cached = { adapter: buildAdapter(effective.activeProvider), signature }
  }
  return cached.adapter
}
```

Cheap DB read on every call (same trade-off `arr` makes), no adapter rebuild unless
`activeProvider` actually changed. `buildAdapter` is a plain switch over the three
adapters below — same shape as `arr`'s `WatchlistProviderRegistry.resolve()`.

Three adapters, each `implements ReceiptExtractionPort`
(`extract(image: Buffer): Promise<ReceiptDraft>`, cf. ADR-0006 — one multimodal
call, no separate OCR step):

- **`GeminiReceiptExtractionAdapter`** — `@google/genai` SDK, vision-capable model,
  structured-output prompt → parsed into `ReceiptDraft`.
- **`OpenAiReceiptExtractionAdapter`** — `openai` SDK, a vision-capable model
  (`gpt-4o`-class), same structured-extraction contract.
- **`OllamaReceiptExtractionAdapter`** — plain HTTP to `OLLAMA_BASE_URL` (new env
  var), model name from `OLLAMA_VISION_MODEL` (new env var) — `.env.example` must
  document that this model must support vision (cf. ADR-0006's caveat).

All three parse the model's response into `ReceiptDraft`; a malformed or empty
response is caught and surfaced as the `extraction_failed` domain error (never an
unhandled exception) — `POST /api/receipts/scan` returns `422` per
`04-endpoints-http.md`.

**New env vars:** `STORAGE_ROOT`, `AI_PROVIDER` (boot-time default, `gemini | openai
| ollama`), `GEMINI_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_BASE_URL`,
`OLLAMA_VISION_MODEL` — all added to `.env`/`.env.example` in Task 1.

## 4. New infrastructure: `ProductLookupPort`

`OpenFoodFactsAdapter` (`src/infrastructure/fridge/openfoodfacts-adapter.ts`) — plain
HTTP GET to OpenFoodFacts' public API, server-side only (ADR-0008 — barcode
*decoding* stays client-side via the app's camera, the backend only ever receives
the decoded barcode string via `GET /api/products/lookup?barcode=...`). Maps a
found product to `ProductLookupResult`; "not found" is a valid `null` result, never
an error (per `04-endpoints-http.md`'s example response).

## 5. Error envelope extensions

Same `{ error: { type, message, details? } }` convention, French messages, extending
`STRING_ERROR_STATUS`/`STRING_ERROR_MESSAGES` in `error-serializer.ts` (established
in Phase 1) rather than a parallel mechanism:

| type | status | when |
|---|---|---|
| `product_not_found` | 404 | product id doesn't exist or isn't in caller's household |
| `receipt_not_found` | 404 | same, for receipt |
| `not_owner` | 403 | already exists (household) — reused for `PATCH /api/settings/ai` |
| `provider_not_configured` | 422 | `PATCH /api/settings/ai` requests a provider with no credentials in env |
| `extraction_failed` | 422 | receipt scan: AI response empty/malformed |
| `image_not_found` | 404 | `imageKey` null, or file missing, or resource out of household |

`no_household` (403, already exists) continues to gate every fridge/receipt
endpoint via `household_required_middleware` — this phase is the first to actually
attach it to routes.

## 6. Testing strategy

Same three-suite structure as Phase 1 (unit / infrastructure / functional):

- **Unit** — `Product`, `Receipt`, `ReceiptDraft`, `AiProviderSettings`, and their
  VOs (`Quantity`, `Location`, `AiProvider`) — pure domain, no I/O.
- **Infrastructure** — Lucid repositories against the real test DB (same
  `db.beginGlobalTransaction()`/rollback pattern as Phase 1's
  `household.repository.spec.ts`), and `LocalFilesystemStorage` against a temp
  directory (`os.tmpdir()`, cleaned up per test).
- **Functional** — real HTTP flow through the app. Critically, **no test hits a
  real AI provider or OpenFoodFacts** — `AiProviderRegistry` and
  `ProductLookupPort` are swapped for deterministic fakes in the test container
  binding (pattern: `~/dev/arr/backend/tests/application/settings/fakes.ts`), so
  CI needs no API keys and stays fast/deterministic. The receipt functional test
  exercises `scan` → edit draft → `import` → confirms `GET /api/products` reflects
  the imported items and `GET /api/receipts/:id` shows them via `receiptId`.

## 7. Task sequencing (for the implementation plan)

Each task ends in a commit with green tests, same discipline as Phase 1:

1. `settings` domain + persistence + `GET/PATCH /api/settings/ai` (unblocks
   `receipt` later; table already migrated)
2. `StorageService` port + `LocalFilesystemStorage` (cross-cutting, needed by both
   `fridge` and `receipt` image routes)
3. `fridge` domain (`Product`, `Quantity`, `Location`)
4. `fridge` persistence (`product` migration, Lucid model, repository)
5. `ProductLookupPort` + `OpenFoodFactsAdapter`
6. `fridge` use-cases + HTTP: `GET/POST /api/products`, `GET/PATCH/DELETE
   /api/products/:id`, `GET /api/products/expiring-soon`, `GET
   /api/products/lookup`, `GET /api/products/:id/image`
7. `receipt` domain (`Receipt`, `ReceiptDraft`, `ReceiptDraftItem`)
8. `ai-provider-registry` + the three `ReceiptExtractionPort` adapters
9. `receipt` persistence (`receipt` migration — note the `product.receipt_id` FK
   ordering caveat in `03-schema-base-de-donnees.md`) + use-cases + HTTP: `POST
   /api/receipts/scan`, `POST /api/receipts/import`, `GET /api/receipts`, `GET
   /api/receipts/:id`, `GET /api/receipts/:id/image` — end-to-end functional test
10. Bruno requests for every new endpoint (mirrors Phase 1's `backend/bruno/`
    structure — new `fridge/`, `receipt/`, `settings/` folders) + boundary-lint
    re-run (dependency-cruiser rules from Phase 1 already cover `src/*` generically,
    no rule changes expected, but Task 11's `pnpm run boundaries` gets re-run as a
    sanity check)

---

## Decisions made during brainstorming (for the record)

- **Scope:** `fridge` + `receipt` together, not `fridge` alone — chosen knowing it
  pulls in `settings` as a prerequisite.
- **`settings`:** built in full (hot-reload, `GET`/`PATCH /api/settings/ai`) per
  ADR-0007, not a throwaway static resolver — avoids replacing code in a later
  phase.
- **AI providers:** all three (`gemini`, `openai`, `ollama`) get real adapters this
  phase, not stubs.
- **Storage backend:** local filesystem only this phase; the `StorageService` port
  is the seam for S3/minio later, not built now.
