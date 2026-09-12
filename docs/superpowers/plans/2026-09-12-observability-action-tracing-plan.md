# Traçage des actions (back + front) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every user-triggered action — read or write, backend or mobile — emits exactly one structured log/telemetry record carrying who did it, what use-case ran, on which entity, and with what outcome.

**Architecture:** Two thin wrappers, each applied at the one place every action already funnels through: `traceAction()` wraps a controller method's body on the backend (logs via the already trace-correlated `ctx.logger`); on mobile, `apiFetch`/`apiFetchMultipart` gain an optional action-context param that names the span already created by `http-client.ts` and records business (non-2xx) failures that were previously invisible. A handful of local-only mobile failures (SecureStore, Share, Clipboard, router) get direct `telemetry.recordError` calls since they have no shared choke point.

**Tech Stack:** AdonisJS 6 (backend), Pino logger + OpenTelemetry NodeSDK (already wired), Japa test runner (backend), React Native/Expo + Jest (mobile), the existing hand-rolled OTLP client in `mobile/src/infrastructure/telemetry/telemetry.ts`.

**Spec:** `docs/superpowers/specs/2026-09-12-observability-action-tracing-design.md`

## Global Constraints

- Action name format: `<domain>.<verb_noun>`, snake_case. Backend derives it automatically (`domain` param + `toSnakeCase(UseCase.name)`); mobile passes the same convention as an explicit string, reusing the operation names `reportFailure(...)` already established where they exist (`identity.get_session`, `home_assistant.get_link`, etc.).
- Never log/attribute free text (names, notes, emails, tokens) — only ids, enums, durations, error types. Matches the existing `logger.redact` list and `attributes/redact` collector processor, which are NOT modified by this plan.
- No new backend functional test per route — `traceAction` is unit-tested once; every controller task's own verification is "existing functional tests still pass" (regression), per spec §6.
- `telemetry.controller.ts` (the mobile telemetry *ingestion* endpoint) is explicitly excluded from backend instrumentation — wrapping the endpoint that receives telemetry in its own action-tracing log adds self-referential noise for no operational benefit; its own rate-limit/pseudonymize logic already provides signal.
- Type consistency: every backend controller task imports `traceAction` from `#presentation/shared/trace-action` (built in Task 1) and follows its two return conventions exactly — `return result` (the `Result<T,E>` value itself) with `{ isError: (r) => !r.ok }` for use-cases that return a `Result`; `return { failed: boolean }` with `{ isError: (r) => r.failed }` for methods with a manual (non-`Result`) failure branch. Every mobile task imports the same `ActionContext` shape from `http-client.ts` (built in Task 12).

---

## File Structure

**Backend — new:**
- `backend/src/presentation/shared/trace-action.ts` — the wrapper (Task 1)
- `backend/tests/unit/presentation/shared/trace-action.spec.ts` — its unit tests (Task 1)

**Backend — modified (one task each, Tasks 2–11):** every method wrapped in `traceAction`, no behavioral change otherwise.
- `backend/src/presentation/fridge/product.controller.ts`
- `backend/src/presentation/receipt/receipt.controller.ts`
- `backend/src/presentation/recipe/recipe.controller.ts`
- `backend/src/presentation/shopping-list/shopping-item.controller.ts`
- `backend/src/presentation/identity/household.controller.ts`
- `backend/src/presentation/identity/session.controller.ts` + `backend/src/presentation/identity/auth-methods.controller.ts` (one task, both tiny)
- `backend/src/presentation/settings/ai-settings.controller.ts`
- `backend/src/presentation/home-assistant/ha-link.controller.ts`

**Mobile — modified:**
- `mobile/src/infrastructure/http/http-client.ts` + `http-client.test.ts` (Task 12) — action-context param, `!response.ok` telemetry fix
- `mobile/src/infrastructure/http/http-fridge-connector.ts` + `http-fridge-connector.test.ts` (Task 13) — action name per call, `signOut()` no longer throws
- `mobile/src/presentation/shared/app-storage.ts` + new `app-storage.test.ts` (Task 14)
- `mobile/src/presentation/identity/invite-share-card.tsx` + new `invite-share-card.test.tsx` (Task 15)
- `mobile/src/presentation/onboarding/threshold-screen.tsx` + `threshold-screen.test.tsx` (Task 16)
- `mobile/src/presentation/fridge/barcode-scanner-screen.tsx` + `barcode-scanner-screen.test.tsx` (Task 17)

**Task 18:** full-suite regression run, both sides.

Files grepped for a `catch` but excluded after inspection (word-only match in a comment, or already covered upstream by Task 13's `apiFetch` fix): `mobile/src/presentation/settings/settings-screen.tsx` (its `signOut` catch is now covered by Task 13's connector fix), `mobile/src/presentation/shopping-list/shopping-list-screen.tsx` (its HA-sync `.catch()` wraps a call already traced by Task 13), `mobile/src/presentation/shared/hover.ts` (an accessibility capability probe, not a user action), `mobile/src/presentation/recipe/recipe-generate-screen.tsx`, `mobile/src/presentation/dashboard/soft-palette.ts`, `mobile/src/presentation/receipt/receipt-review-screen.tsx`, `mobile/src/presentation/fridge/fridge-cabinet.tsx`, `mobile/src/presentation/onboarding/invite-code-field.tsx` (all five: "catch" only appears inside a comment, no actual `try`/`catch`).

---

### Task 1: `traceAction` wrapper (backend)

**Files:**
- Create: `backend/src/presentation/shared/trace-action.ts`
- Test: `backend/tests/unit/presentation/shared/trace-action.spec.ts`

**Interfaces:**
- Produces: `traceAction<T>(ctx: ActionContext, domain: string, useCase: { name: string }, fn: () => Promise<T>, opts?: { isError?: (result: T) => boolean; entityId?: (result: T) => string | undefined }): Promise<T>`, and the exported `ActionContext` interface (`logger`, `authenticatedUser`, `household`, `params`). Every later backend task imports `traceAction` from `#presentation/shared/trace-action` and passes a real `HttpContext` as `ctx` — it satisfies `ActionContext` structurally, no cast needed.

- [ ] **Step 1: Write the failing unit tests**

```typescript
// backend/tests/unit/presentation/shared/trace-action.spec.ts
import { test } from '@japa/runner'
import { traceAction, type ActionContext } from '#presentation/shared/trace-action'

function fakeContext(overrides: Partial<ActionContext> = {}) {
  const calls: { level: 'info' | 'warn' | 'error'; obj: Record<string, unknown>; msg: string }[] = []
  const ctx: ActionContext = {
    logger: {
      info: (obj, msg) => calls.push({ level: 'info', obj, msg }),
      warn: (obj, msg) => calls.push({ level: 'warn', obj, msg }),
      error: (obj, msg) => calls.push({ level: 'error', obj, msg }),
    },
    authenticatedUser: { id: 'user-1' },
    household: { id: 'household-1' },
    params: {},
    ...overrides,
  }
  return { ctx, calls }
}

test.group('traceAction', () => {
  test('success with no opts: logs info with outcome success', async ({ assert }) => {
    const { ctx, calls } = fakeContext()
    const result = await traceAction(ctx, 'fridge', { name: 'ListProducts' }, async () => ['p1'])

    assert.deepEqual(result, ['p1'])
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.level, 'info')
    assert.equal(calls[0]?.msg, 'action:fridge.list_products')
    assert.equal(calls[0]?.obj.action, 'fridge.list_products')
    assert.equal(calls[0]?.obj.useCase, 'ListProducts')
    assert.equal(calls[0]?.obj.userId, 'user-1')
    assert.equal(calls[0]?.obj.householdId, 'household-1')
    assert.equal(calls[0]?.obj.outcome, 'success')
    assert.isNumber(calls[0]?.obj.durationMs)
  })

  test('isError predicate true: logs warn with outcome error, still returns the value', async ({ assert }) => {
    const { ctx, calls } = fakeContext()
    const result = await traceAction(
      ctx,
      'fridge',
      { name: 'CreateProduct' },
      async () => ({ ok: false as const }),
      { isError: (r) => !r.ok },
    )

    assert.deepEqual(result, { ok: false })
    assert.equal(calls[0]?.level, 'warn')
    assert.equal(calls[0]?.obj.outcome, 'error')
  })

  test('fn throws: logs error with errorType, then re-throws the same error', async ({ assert }) => {
    const { ctx, calls } = fakeContext()
    let thrown: unknown

    try {
      await traceAction(ctx, 'fridge', { name: 'CreateProduct' }, async () => {
        throw new TypeError('boom')
      })
    } catch (error) {
      thrown = error
    }

    assert.instanceOf(thrown, TypeError)
    assert.equal(calls[0]?.level, 'error')
    assert.equal(calls[0]?.obj.outcome, 'error')
    assert.equal(calls[0]?.obj.errorType, 'TypeError')
  })

  test('entityId: route param wins when present, opts.entityId is the fallback', async ({ assert }) => {
    const { ctx: withParam, calls: callsWithParam } = fakeContext({ params: { id: 'route-id' } })
    await traceAction(withParam, 'fridge', { name: 'UpdateProduct' }, async () => ({ ok: true as const }), {
      entityId: () => 'from-result',
    })
    assert.equal(callsWithParam[0]?.obj.entityId, 'route-id')

    const { ctx: withoutParam, calls: callsWithoutParam } = fakeContext()
    await traceAction(withoutParam, 'fridge', { name: 'CreateProduct' }, async () => ({ ok: true as const }), {
      entityId: () => 'from-result',
    })
    assert.equal(callsWithoutParam[0]?.obj.entityId, 'from-result')
  })

  test('action name is domain + snake_case of the UseCase name', async ({ assert }) => {
    const { ctx, calls } = fakeContext()
    await traceAction(ctx, 'home_assistant', { name: 'GetExpiringSoonProducts' }, async () => undefined)
    assert.equal(calls[0]?.obj.action, 'home_assistant.get_expiring_soon_products')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && node ace test --files=trace-action`
Expected: FAIL — `Cannot find module '#presentation/shared/trace-action'`

- [ ] **Step 3: Write `trace-action.ts`**

```typescript
// backend/src/presentation/shared/trace-action.ts
type LogFn = (mergingObject: Record<string, unknown>, message: string) => void

/**
 * The narrow slice of `HttpContext` this needs — a real request satisfies it
 * structurally (no cast at call sites), and a unit test can pass a plain
 * object instead of constructing a real HttpContext.
 */
export interface ActionContext {
  logger: { info: LogFn; warn: LogFn; error: LogFn }
  authenticatedUser: { id: string } | null
  household: { id: string } | null | undefined
  params: Record<string, string | undefined>
}

export interface TraceActionOptions<T> {
  /**
   * `true` when `fn`'s result represents a business failure (e.g. `!result.ok`
   * on a `Result`, or a manually-set `{ failed: true }`). Omit when the
   * action has no failure branch — outcome is then always `success` unless
   * `fn` throws.
   */
  isError?: (result: T) => boolean
  /** Resolves the id of the entity the action produced/targeted, when it is not already the route's `:id` param. */
  entityId?: (result: T) => string | undefined
}

function toSnakeCase(pascalCase: string): string {
  return pascalCase.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

/**
 * Wraps a controller action's body so every business action — read or
 * write — emits exactly one structured log line, with `trace_id`/`span_id`
 * already injected by `PinoInstrumentation` (see `instrumentation.ts`) and
 * mirrored to the OTLP logs pipeline. Never changes what `fn` returns or
 * throws — only observes it.
 */
export async function traceAction<T>(
  ctx: ActionContext,
  domain: string,
  useCase: { name: string },
  fn: () => Promise<T>,
  opts?: TraceActionOptions<T>,
): Promise<T> {
  const startedAt = performance.now()
  const action = `${domain}.${toSnakeCase(useCase.name)}`
  const base = {
    action,
    useCase: useCase.name,
    userId: ctx.authenticatedUser?.id,
    householdId: ctx.household?.id,
    entityId: ctx.params.id,
  }

  try {
    const result = await fn()
    const failed = opts?.isError?.(result) ?? false
    ctx.logger[failed ? 'warn' : 'info'](
      {
        ...base,
        entityId: base.entityId ?? opts?.entityId?.(result),
        durationMs: Math.round(performance.now() - startedAt),
        outcome: failed ? 'error' : 'success',
      },
      `action:${action}`,
    )
    return result
  } catch (error) {
    ctx.logger.error(
      {
        ...base,
        durationMs: Math.round(performance.now() - startedAt),
        outcome: 'error',
        errorType: error instanceof Error ? error.constructor.name : 'unknown',
      },
      `action:${action}`,
    )
    throw error
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && node ace test --files=trace-action`
Expected: PASS — 5 tests green

- [ ] **Step 5: Commit**

```bash
git add backend/src/presentation/shared/trace-action.ts backend/tests/unit/presentation/shared/trace-action.spec.ts
git commit -m "feat(backend): add traceAction wrapper for per-action structured logging"
```

---

### Task 2: Wrap `product.controller.ts`

**Files:**
- Modify: `backend/src/presentation/fridge/product.controller.ts`

**Interfaces:**
- Consumes: `traceAction` from Task 1.

- [ ] **Step 1: Replace the file**

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import {
  createProductValidator,
  updateProductValidator,
  listProductsValidator,
  expiringSoonValidator,
  lookupProductValidator,
} from './product.validator.js'
import { toProductDto } from './product.dto.js'
import { CreateProduct } from '#application/fridge/create-product.use-case'
import { UpdateProduct } from '#application/fridge/update-product.use-case'
import { DeleteProduct } from '#application/fridge/delete-product.use-case'
import { GetProduct } from '#application/fridge/get-product.use-case'
import { ListProducts } from '#application/fridge/list-products.use-case'
import { GetExpiringSoonProducts } from '#application/fridge/get-expiring-soon-products.use-case'
import { LookupProduct } from '#application/fridge/lookup-product.use-case'

export default class ProductController {
  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'fridge', ListProducts, async () => {
      const { location, expiringWithinDays } = await ctx.request.validateUsing(listProductsValidator)
      const products = await ctx.containerResolver.make('fridge.products')

      const result = await new ListProducts(products).execute({
        householdId: ctx.household.id,
        location,
        expiringWithinDays,
      })
      ctx.response.json({ products: result.map(toProductDto) })
    })
  }

  async store(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'fridge', CreateProduct, async () => {
      const payload = await ctx.request.validateUsing(createProductValidator)
      const products = await ctx.containerResolver.make('fridge.products')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new CreateProduct(products, idGenerator, clock).execute({
        householdId: ctx.household.id,
        ...payload,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.status(201).json({ product: toProductDto(result.value) })
      return result
    }, { isError: (r) => !r.ok, entityId: (r) => (r.ok ? r.value.id : undefined) })
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'fridge', GetProduct, async () => {
      const products = await ctx.containerResolver.make('fridge.products')
      const product = await new GetProduct(products).execute({
        householdId: ctx.household.id,
        productId: ctx.params.id,
      })
      if (!product) {
        const { status, body } = serializeError('product_not_found')
        ctx.response.status(status).json(body)
        return { failed: true }
      }
      ctx.response.json({ product: toProductDto(product) })
      return { failed: false }
    }, { isError: (r) => r.failed })
  }

  async update(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'fridge', UpdateProduct, async () => {
      const payload = await ctx.request.validateUsing(updateProductValidator)
      const products = await ctx.containerResolver.make('fridge.products')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new UpdateProduct(products, clock).execute({
        householdId: ctx.household.id,
        productId: ctx.params.id,
        ...payload,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json({ product: toProductDto(result.value) })
      return result
    }, { isError: (r) => !r.ok })
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'fridge', DeleteProduct, async () => {
      const products = await ctx.containerResolver.make('fridge.products')
      const result = await new DeleteProduct(products).execute({
        householdId: ctx.household.id,
        productId: ctx.params.id,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.status(204).send('')
      return result
    }, { isError: (r) => !r.ok })
  }

  async expiringSoon(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'fridge', GetExpiringSoonProducts, async () => {
      const { days } = await ctx.request.validateUsing(expiringSoonValidator)
      const products = await ctx.containerResolver.make('fridge.products')
      const result = await new GetExpiringSoonProducts(products).execute({
        householdId: ctx.household.id,
        days: days ?? 3,
      })
      ctx.response.json({ products: result.map(toProductDto) })
    })
  }

  async lookup(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'fridge', LookupProduct, async () => {
      const { barcode } = await ctx.request.validateUsing(lookupProductValidator)
      const lookupPort = await ctx.containerResolver.make('fridge.productLookup')
      const result = await new LookupProduct(lookupPort).execute({ barcode })
      ctx.response.json({ result })
    })
  }

  async image(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'fridge', { name: 'GetProductImage' }, async () => {
      const products = await ctx.containerResolver.make('fridge.products')
      const product = await new GetProduct(products).execute({
        householdId: ctx.household.id,
        productId: ctx.params.id,
      })
      if (!product || !product.imageKey) {
        const { status, body } = serializeError('image_not_found')
        ctx.response.status(status).json(body)
        return { failed: true }
      }

      const storage = await ctx.containerResolver.make('shared.storage')
      const file = await storage.read(product.imageKey)
      if (!file) {
        const { status, body } = serializeError('image_not_found')
        ctx.response.status(status).json(body)
        return { failed: true }
      }

      ctx.response.header('Content-Type', file.contentType)
      ctx.response.send(file.buffer)
      return { failed: false }
    }, { isError: (r) => r.failed })
  }
}
```

- [ ] **Step 2: Run the existing functional suite for this domain**

Run: `cd backend && node ace test --files=fridge`
Expected: PASS — same assertions as before, response shapes unchanged

- [ ] **Step 3: Commit**

```bash
git add backend/src/presentation/fridge/product.controller.ts
git commit -m "feat(backend): trace fridge product actions"
```

---

### Task 3: Wrap `receipt.controller.ts`

**Files:**
- Modify: `backend/src/presentation/receipt/receipt.controller.ts`

- [ ] **Step 1: Replace the file**

```typescript
import { readFile } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import { importReceiptValidator } from './receipt.validator.js'
import { toReceiptDraftDto, toReceiptDto } from './receipt.dto.js'
import { toProductDto } from '#presentation/fridge/product.dto'
import { ScanReceipt } from '#application/receipt/scan-receipt.use-case'
import { ImportReceipt } from '#application/receipt/import-receipt.use-case'
import { GetReceipt } from '#application/receipt/get-receipt.use-case'
import { ListReceipts } from '#application/receipt/list-receipts.use-case'

export default class ReceiptController {
  async scan(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'receipt', ScanReceipt, async () => {
      const image = ctx.request.file('image', {
        extnames: ['jpg', 'jpeg', 'png', 'webp'],
        size: '10mb',
      })
      if (!image || !image.tmpPath) {
        // The most common real cause of "extraction impossible" with nothing
        // in the AI-adapter logs: the multipart upload itself never produced
        // a usable file (wrong field name, no file attached, tmp write
        // failed) — this used to fall straight through to a generic
        // extraction_failed with no trace anywhere.
        logger.warn(
          { field: 'image', hasFile: Boolean(image), clientName: image?.clientName },
          'receipt scan: no usable file in upload',
        )
        const { status, body } = serializeError('extraction_failed')
        ctx.response.status(status).json(body)
        return { failed: true }
      }
      if (!image.isValid) {
        logger.warn(
          {
            clientName: image.clientName,
            size: image.size,
            extname: image.extname,
            errors: image.errors,
          },
          'receipt scan: uploaded file failed validation',
        )
        const { status, body } = serializeError('extraction_failed')
        ctx.response.status(status).json(body)
        return { failed: true }
      }

      const buffer = await readFile(image.tmpPath)
      const resolveExtraction = await ctx.containerResolver.make(
        'settings.resolveReceiptExtractionPort',
      )
      const extraction = await resolveExtraction()

      const result = await new ScanReceipt(extraction).execute({ image: buffer })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return { failed: true }
      }
      ctx.response.json({ draft: toReceiptDraftDto(result.value) })
      return { failed: false }
    }, { isError: (r) => r.failed })
  }

  async importReceipt(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'receipt', ImportReceipt, async () => {
      const payload = await ctx.request.validateUsing(importReceiptValidator)
      const receipts = await ctx.containerResolver.make('receipt.receipts')
      const products = await ctx.containerResolver.make('fridge.products')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new ImportReceipt(receipts, products, idGenerator, clock).execute({
        householdId: ctx.household.id,
        storeName: payload.storeName,
        scannedAt: payload.scannedAt,
        totalAmount: payload.totalAmount,
        // imageKey is always server-generated (no phase-2 write path exists yet); never
        // sourced from client input to avoid unsanitized data reaching filesystem paths.
        imageKey: null,
        items: payload.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category ?? null,
          price: item.price ?? null,
          location: item.location,
          expiresAt: item.expiresAt ?? null,
        })),
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      ctx.response.status(201).json({
        receipt: toReceiptDto(result.value.receipt),
        products: result.value.products.map(toProductDto),
      })
      return result
    }, { isError: (r) => !r.ok, entityId: (r) => (r.ok ? r.value.receipt.id : undefined) })
  }

  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'receipt', ListReceipts, async () => {
      const receipts = await ctx.containerResolver.make('receipt.receipts')
      const result = await new ListReceipts(receipts).execute({ householdId: ctx.household.id })
      ctx.response.json({ receipts: result.map(toReceiptDto) })
    })
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'receipt', GetReceipt, async () => {
      const receipts = await ctx.containerResolver.make('receipt.receipts')
      const products = await ctx.containerResolver.make('fridge.products')
      const result = await new GetReceipt(receipts, products).execute({
        householdId: ctx.household.id,
        receiptId: ctx.params.id,
      })
      if (!result) {
        const { status, body } = serializeError('receipt_not_found')
        ctx.response.status(status).json(body)
        return { failed: true }
      }
      ctx.response.json({
        receipt: toReceiptDto(result.receipt),
        products: result.products.map(toProductDto),
      })
      return { failed: false }
    }, { isError: (r) => r.failed })
  }

  async image(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'receipt', { name: 'GetReceiptImage' }, async () => {
      const receipts = await ctx.containerResolver.make('receipt.receipts')
      const receipt = await receipts.findById(ctx.params.id)
      if (!receipt || receipt.householdId !== ctx.household.id || !receipt.imageKey) {
        const { status, body } = serializeError('image_not_found')
        ctx.response.status(status).json(body)
        return { failed: true }
      }

      const storage = await ctx.containerResolver.make('shared.storage')
      const file = await storage.read(receipt.imageKey)
      if (!file) {
        const { status, body } = serializeError('image_not_found')
        ctx.response.status(status).json(body)
        return { failed: true }
      }

      ctx.response.header('Content-Type', file.contentType)
      ctx.response.send(file.buffer)
      return { failed: false }
    }, { isError: (r) => r.failed })
  }
}
```

- [ ] **Step 2: Run the existing functional suite for this domain**

Run: `cd backend && node ace test --files=receipt`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/presentation/receipt/receipt.controller.ts
git commit -m "feat(backend): trace receipt actions"
```

---

### Task 4: Wrap `recipe.controller.ts`

**Files:**
- Modify: `backend/src/presentation/recipe/recipe.controller.ts`

- [ ] **Step 1: Replace the file**

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import {
  cookRecipeValidator,
  generateRecipesValidator,
  saveRecipeValidator,
} from './recipe.validator.js'
import { toRecipeDto, toRecipeDraftDto } from './recipe.dto.js'
import { GenerateRecipes } from '#application/recipe/generate-recipes.use-case'
import { SuggestRecipes } from '#application/recipe/suggest-recipes.use-case'
import { SaveRecipe } from '#application/recipe/save-recipe.use-case'
import { ListRecipes } from '#application/recipe/list-recipes.use-case'
import { ShowRecipe } from '#application/recipe/show-recipe.use-case'
import { DeleteRecipe } from '#application/recipe/delete-recipe.use-case'
import { CookRecipe } from '#application/recipe/cook-recipe.use-case'

export default class RecipeController {
  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'recipe', ListRecipes, async () => {
      const recipes = await ctx.containerResolver.make('recipe.recipes')
      const result = await new ListRecipes(recipes).execute({ householdId: ctx.household.id })
      ctx.response.json({ recipes: result.map(toRecipeDto) })
    })
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'recipe', ShowRecipe, async () => {
      const recipes = await ctx.containerResolver.make('recipe.recipes')
      const recipe = await new ShowRecipe(recipes).execute({
        householdId: ctx.household.id,
        recipeId: ctx.params.id,
      })
      if (!recipe) {
        const { status, body } = serializeError('recipe_not_found')
        ctx.response.status(status).json(body)
        return { failed: true }
      }
      ctx.response.json({ recipe: toRecipeDto(recipe) })
      return { failed: false }
    }, { isError: (r) => r.failed })
  }

  async generate(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'recipe', GenerateRecipes, async () => {
      const { prompt } = await ctx.request.validateUsing(generateRecipesValidator)
      const recipes = await ctx.containerResolver.make('recipe.recipes')
      const products = await ctx.containerResolver.make('fridge.products')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')
      const resolveGeneration = await ctx.containerResolver.make(
        'settings.resolveRecipeGenerationPort',
      )
      const generation = await resolveGeneration()

      const result = await new GenerateRecipes(
        recipes,
        products,
        generation,
        idGenerator,
        clock,
      ).execute({ householdId: ctx.household.id, createdBy: user.id, prompt })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.status(201).json({ recipes: result.value.map(toRecipeDto) })
      return result
    }, { isError: (r) => !r.ok })
  }

  async suggestions(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'recipe', SuggestRecipes, async () => {
      const products = await ctx.containerResolver.make('fridge.products')
      const resolveGeneration = await ctx.containerResolver.make(
        'settings.resolveRecipeGenerationPort',
      )
      const generation = await resolveGeneration()

      const result = await new SuggestRecipes(products, generation).execute({
        householdId: ctx.household.id,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json({ recipes: result.value.map(toRecipeDraftDto) })
      return result
    }, { isError: (r) => !r.ok })
  }

  async store(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'recipe', SaveRecipe, async () => {
      const payload = await ctx.request.validateUsing(saveRecipeValidator)
      const recipes = await ctx.containerResolver.make('recipe.recipes')
      const products = await ctx.containerResolver.make('fridge.products')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new SaveRecipe(recipes, products, idGenerator, clock).execute({
        householdId: ctx.household.id,
        createdBy: user.id,
        ...payload,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.status(201).json({ recipe: toRecipeDto(result.value) })
      return result
    }, { isError: (r) => !r.ok, entityId: (r) => (r.ok ? r.value.id : undefined) })
  }

  /**
   * "J'ai cuisiné" — the other half of the recommendation.
   *
   * The client sends the products the meal used up, because the client is
   * where the rapprochement between an ingredient and a real product was
   * confirmed; the generator never links them.
   */
  async cooked(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'recipe', CookRecipe, async () => {
      const { productIds } = await ctx.request.validateUsing(cookRecipeValidator)
      const recipes = await ctx.containerResolver.make('recipe.recipes')
      const products = await ctx.containerResolver.make('fridge.products')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new CookRecipe(recipes, products, idGenerator, clock).execute({
        householdId: ctx.household.id,
        userId: user.id,
        recipeId: ctx.params.id,
        productIds: productIds ?? [],
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json({ recipe: toRecipeDto(result.value) })
      return result
    }, { isError: (r) => !r.ok })
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'recipe', DeleteRecipe, async () => {
      const recipes = await ctx.containerResolver.make('recipe.recipes')
      const result = await new DeleteRecipe(recipes).execute({
        householdId: ctx.household.id,
        recipeId: ctx.params.id,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.status(204).send('')
      return result
    }, { isError: (r) => !r.ok })
  }
}
```

- [ ] **Step 2: Run the existing functional suite for this domain**

Run: `cd backend && node ace test --files=recipe`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/presentation/recipe/recipe.controller.ts
git commit -m "feat(backend): trace recipe actions"
```

---

### Task 5: Wrap `shopping-item.controller.ts`

**Files:**
- Modify: `backend/src/presentation/shopping-list/shopping-item.controller.ts`

- [ ] **Step 1: Replace the file**

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import {
  createShoppingItemValidator,
  updateShoppingItemValidator,
} from './shopping-item.validator.js'
import { toShoppingItemDto } from './shopping-item.dto.js'
import { CreateShoppingItem } from '#application/shopping-list/create-shopping-item.use-case'
import { ListShoppingItems } from '#application/shopping-list/list-shopping-items.use-case'
import { UpdateShoppingItem } from '#application/shopping-list/update-shopping-item.use-case'
import { DeleteShoppingItem } from '#application/shopping-list/delete-shopping-item.use-case'

export default class ShoppingItemController {
  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'shopping_list', ListShoppingItems, async () => {
      const items = await ctx.containerResolver.make('shoppingList.items')
      const result = await new ListShoppingItems(items).execute({ householdId: ctx.household.id })
      ctx.response.json({ items: result.map(toShoppingItemDto) })
    })
  }

  async store(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'shopping_list', CreateShoppingItem, async () => {
      const payload = await ctx.request.validateUsing(createShoppingItemValidator)
      const items = await ctx.containerResolver.make('shoppingList.items')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new CreateShoppingItem(items, idGenerator, clock).execute({
        householdId: ctx.household.id,
        ...payload,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      const mirror = await ctx.containerResolver.make('homeAssistant.shoppingListMirror')
      // A merge (`created: false`) touched an existing line — HA already has
      // it, so this must update that entry, not add a second one.
      if (result.value.created) {
        await mirror.itemCreated(result.value.item)
      } else {
        await mirror.itemUpdated(result.value.item)
      }
      ctx.response.status(201).json({ item: toShoppingItemDto(result.value.item) })
      return result
    }, { isError: (r) => !r.ok, entityId: (r) => (r.ok ? r.value.item.id : undefined) })
  }

  async update(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'shopping_list', UpdateShoppingItem, async () => {
      const payload = await ctx.request.validateUsing(updateShoppingItemValidator)
      const items = await ctx.containerResolver.make('shoppingList.items')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new UpdateShoppingItem(items, clock).execute({
        householdId: ctx.household.id,
        itemId: ctx.params.id,
        ...payload,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      const mirror = await ctx.containerResolver.make('homeAssistant.shoppingListMirror')
      await mirror.itemUpdated(result.value)
      ctx.response.json({ item: toShoppingItemDto(result.value) })
      return result
    }, { isError: (r) => !r.ok })
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'shopping_list', DeleteShoppingItem, async () => {
      const items = await ctx.containerResolver.make('shoppingList.items')
      // Fetched before the delete so its haUid is still known — DeleteShoppingItem
      // does its own lookup internally and returns void, not the deleted item.
      const existing = await items.findById(ctx.params.id)
      const result = await new DeleteShoppingItem(items).execute({
        householdId: ctx.household.id,
        itemId: ctx.params.id,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      const mirror = await ctx.containerResolver.make('homeAssistant.shoppingListMirror')
      await mirror.itemDeleted(ctx.household.id, existing?.haUid ?? null)
      ctx.response.status(204).send('')
      return result
    }, { isError: (r) => !r.ok })
  }
}
```

- [ ] **Step 2: Run the existing functional suite for this domain**

Run: `cd backend && node ace test --files=shopping-list`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/presentation/shopping-list/shopping-item.controller.ts
git commit -m "feat(backend): trace shopping-list actions"
```

---

### Task 6: Wrap `household.controller.ts`

**Files:**
- Modify: `backend/src/presentation/identity/household.controller.ts`

- [ ] **Step 1: Replace the file**

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import { createHouseholdValidator, joinHouseholdValidator } from './household.validator.js'
import { toHouseholdDto } from './household.dto.js'
import { CreateHousehold } from '#application/identity/create-household.use-case'
import { JoinHousehold } from '#application/identity/join-household.use-case'
import { GetMyHousehold } from '#application/identity/get-my-household.use-case'
import { RegenerateInviteCode } from '#application/identity/regenerate-invite-code.use-case'
import { RemoveHouseholdMember } from '#application/identity/remove-household-member.use-case'
import { LeaveHousehold } from '#application/identity/leave-household.use-case'
import { DeleteHousehold } from '#application/identity/delete-household.use-case'

export default class HouseholdController {
  async mine(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', GetMyHousehold, async () => {
      const households = await ctx.containerResolver.make('identity.households')
      const userDirectory = await ctx.containerResolver.make('identity.userDirectory')

      const household = await new GetMyHousehold(households).execute({ userId: user.id })
      if (!household) {
        ctx.response.json({ household: null })
        return
      }

      const members = await userDirectory.findByIds(household.members.map((m) => m.userId))
      ctx.response.json({ household: toHouseholdDto(household, user.id, members) })
    })
  }

  async create(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', CreateHousehold, async () => {
      const payload = await ctx.request.validateUsing(createHouseholdValidator)
      const households = await ctx.containerResolver.make('identity.households')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')
      const userDirectory = await ctx.containerResolver.make('identity.userDirectory')

      const result = await new CreateHousehold(households, idGenerator, clock).execute({
        userId: user.id,
        name: payload.name,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      const members = await userDirectory.findByIds([user.id])
      ctx.response.status(201).json({ household: toHouseholdDto(result.value, user.id, members) })
      return result
    }, { isError: (r) => !r.ok, entityId: (r) => (r.ok ? r.value.id : undefined) })
  }

  async join(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', JoinHousehold, async () => {
      const payload = await ctx.request.validateUsing(joinHouseholdValidator)
      const households = await ctx.containerResolver.make('identity.households')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')
      const userDirectory = await ctx.containerResolver.make('identity.userDirectory')

      const result = await new JoinHousehold(households, idGenerator, clock).execute({
        userId: user.id,
        inviteCode: payload.inviteCode,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      const members = await userDirectory.findByIds(result.value.members.map((m) => m.userId))
      ctx.response.json({ household: toHouseholdDto(result.value, user.id, members) })
      return result
    }, { isError: (r) => !r.ok, entityId: (r) => (r.ok ? r.value.id : undefined) })
  }

  async regenerateInviteCode(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', RegenerateInviteCode, async () => {
      const households = await ctx.containerResolver.make('identity.households')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')

      const result = await new RegenerateInviteCode(households, idGenerator).execute({
        userId: user.id,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      ctx.response.json({ inviteCode: result.value.inviteCode.value })
      return result
    }, { isError: (r) => !r.ok })
  }

  async removeMember(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', RemoveHouseholdMember, async () => {
      const households = await ctx.containerResolver.make('identity.households')

      const result = await new RemoveHouseholdMember(households).execute({
        userId: user.id,
        targetUserId: ctx.params.userId,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      ctx.response.status(204).send('')
      return result
      // `:userId`, not `:id` — this route names its param differently, so
      // traceAction's free `ctx.params.id` lookup would miss it entirely.
    }, { isError: (r) => !r.ok, entityId: () => ctx.params.userId })
  }

  async leave(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', LeaveHousehold, async () => {
      const households = await ctx.containerResolver.make('identity.households')

      const result = await new LeaveHousehold(households).execute({ userId: user.id })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      ctx.response.status(204).send('')
      return result
    }, { isError: (r) => !r.ok })
  }

  async destroy(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'identity', DeleteHousehold, async () => {
      const households = await ctx.containerResolver.make('identity.households')

      const result = await new DeleteHousehold(households).execute({ userId: user.id })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      ctx.response.status(204).send('')
      return result
    }, { isError: (r) => !r.ok })
  }
}
```

- [ ] **Step 2: Run the existing functional suite for this domain**

Run: `cd backend && node ace test --files=identity`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/presentation/identity/household.controller.ts
git commit -m "feat(backend): trace household actions"
```

---

### Task 7: Wrap `session.controller.ts` + `auth-methods.controller.ts`

**Files:**
- Modify: `backend/src/presentation/identity/session.controller.ts`
- Modify: `backend/src/presentation/identity/auth-methods.controller.ts`

- [ ] **Step 1: Replace `session.controller.ts`**

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import { getAuthenticatedUser } from '#presentation/shared/auth-context'
import { traceAction } from '#presentation/shared/trace-action'

export default class SessionController {
  async show(ctx: HttpContext) {
    return traceAction(ctx, 'identity', { name: 'GetSession' }, async () => {
      const user = getAuthenticatedUser(ctx)
      ctx.response.json({
        user: user ? { id: user.id, email: user.email.value, name: user.name } : null,
      })
    })
  }
}
```

- [ ] **Step 2: Replace `auth-methods.controller.ts`**

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import { traceAction } from '#presentation/shared/trace-action'
import { GetAuthMethods } from '#application/identity/get-auth-methods.use-case'

export default class AuthMethodsController {
  async index(ctx: HttpContext) {
    return traceAction(ctx, 'identity', GetAuthMethods, async () => {
      const provider = await ctx.containerResolver.make('identity.authMethodsProvider')
      const methods = await new GetAuthMethods(provider).execute()
      ctx.response.json({
        methods: methods.map((m) => ({ id: m.id, enabled: m.enabled, label: m.label })),
      })
    })
  }
}
```

- [ ] **Step 3: Run the existing functional suite for this domain**

Run: `cd backend && node ace test --files=identity`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/presentation/identity/session.controller.ts backend/src/presentation/identity/auth-methods.controller.ts
git commit -m "feat(backend): trace session and auth-methods reads"
```

---

### Task 8: Wrap `ai-settings.controller.ts`

**Files:**
- Modify: `backend/src/presentation/settings/ai-settings.controller.ts`

- [ ] **Step 1: Replace the file**

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import { setActiveAiProviderValidator } from './ai-settings.validator.js'
import { toAiSettingsDto } from './ai-settings.dto.js'
import { GetEffectiveAiSettings } from '#application/settings/get-effective-ai-settings.use-case'
import { SetActiveAiProvider } from '#application/settings/set-active-ai-provider.use-case'

export default class AiSettingsController {
  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'settings', GetEffectiveAiSettings, async () => {
      const settingsProvider = await ctx.containerResolver.make('settings.aiSettingsProvider')
      const effective = await new GetEffectiveAiSettings(settingsProvider).execute()
      ctx.response.json(toAiSettingsDto(effective))
    })
  }

  async update(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'settings', SetActiveAiProvider, async () => {
      const payload = await ctx.request.validateUsing(setActiveAiProviderValidator)
      const repository = await ctx.containerResolver.make('settings.aiProviderSettingsRepository')
      const settingsProvider = await ctx.containerResolver.make('settings.aiSettingsProvider')
      const households = await ctx.containerResolver.make('identity.households')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new SetActiveAiProvider(
        repository,
        settingsProvider,
        households,
        idGenerator,
        clock,
      ).execute({ userId: user.id, provider: payload.provider })

      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      const effective = await settingsProvider.resolveEffective()
      ctx.response.json(toAiSettingsDto(effective))
      return result
    }, { isError: (r) => !r.ok })
  }
}
```

- [ ] **Step 2: Run the existing functional suite for this domain**

Run: `cd backend && node ace test --files=settings`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/presentation/settings/ai-settings.controller.ts
git commit -m "feat(backend): trace ai-settings actions"
```

---

### Task 9: Wrap `ha-link.controller.ts`

**Files:**
- Modify: `backend/src/presentation/home-assistant/ha-link.controller.ts`

- [ ] **Step 1: Replace the file**

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import {
  saveHomeAssistantConnectionValidator,
  discoverTodoEntitiesValidator,
  bindHomeAssistantListValidator,
} from './ha-link.validator.js'
import { toHomeAssistantLinkDto } from './ha-link.dto.js'
import { GetHomeAssistantLink } from '#application/home-assistant/get-home-assistant-link.use-case'
import { SaveHomeAssistantConnection } from '#application/home-assistant/save-home-assistant-connection.use-case'
import { DiscoverTodoEntities } from '#application/home-assistant/discover-todo-entities.use-case'
import { BindHomeAssistantList } from '#application/home-assistant/bind-home-assistant-list.use-case'
import { UnlinkHomeAssistant } from '#application/home-assistant/unlink-home-assistant.use-case'
import { SyncShoppingList } from '#application/home-assistant/sync-shopping-list.use-case'

export default class HaLinkController {
  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'home_assistant', GetHomeAssistantLink, async () => {
      const links = await ctx.containerResolver.make('homeAssistant.links')
      const result = await new GetHomeAssistantLink(links).execute({ householdId: ctx.household.id })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json(toHomeAssistantLinkDto(result.value))
      return result
    }, { isError: (r) => !r.ok })
  }

  async update(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'home_assistant', SaveHomeAssistantConnection, async () => {
      const payload = await ctx.request.validateUsing(saveHomeAssistantConnectionValidator)
      const links = await ctx.containerResolver.make('homeAssistant.links')
      const client = await ctx.containerResolver.make('homeAssistant.client')
      const hostPolicy = await ctx.containerResolver.make('homeAssistant.hostPolicy')
      const households = await ctx.containerResolver.make('identity.households')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new SaveHomeAssistantConnection(
        links,
        client,
        hostPolicy,
        households,
        idGenerator,
        clock,
      ).execute({
        userId: user.id,
        householdId: ctx.household.id,
        instanceUrl: payload.instanceUrl,
        token: payload.token ?? '',
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json(toHomeAssistantLinkDto(result.value))
      return result
    }, { isError: (r) => !r.ok })
  }

  async discover(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'home_assistant', DiscoverTodoEntities, async () => {
      const payload = await ctx.request.validateUsing(discoverTodoEntitiesValidator)
      const links = await ctx.containerResolver.make('homeAssistant.links')
      const client = await ctx.containerResolver.make('homeAssistant.client')
      const hostPolicy = await ctx.containerResolver.make('homeAssistant.hostPolicy')
      const households = await ctx.containerResolver.make('identity.households')

      const result = await new DiscoverTodoEntities(links, client, hostPolicy, households).execute({
        userId: user.id,
        householdId: ctx.household.id,
        instanceUrl: payload.instanceUrl,
        token: payload.token,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json({ entities: result.value })
      return result
    }, { isError: (r) => !r.ok })
  }

  async bind(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'home_assistant', BindHomeAssistantList, async () => {
      const payload = await ctx.request.validateUsing(bindHomeAssistantListValidator)
      const links = await ctx.containerResolver.make('homeAssistant.links')
      const households = await ctx.containerResolver.make('identity.households')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new BindHomeAssistantList(links, households, clock).execute({
        userId: user.id,
        householdId: ctx.household.id,
        ...payload,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json(toHomeAssistantLinkDto(result.value))
      return result
    }, { isError: (r) => !r.ok })
  }

  async destroy(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'home_assistant', UnlinkHomeAssistant, async () => {
      const links = await ctx.containerResolver.make('homeAssistant.links')
      const items = await ctx.containerResolver.make('shoppingList.items')
      const households = await ctx.containerResolver.make('identity.households')

      const result = await new UnlinkHomeAssistant(links, items, households).execute({
        userId: user.id,
        householdId: ctx.household.id,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.status(204).send('')
      return result
    }, { isError: (r) => !r.ok })
  }

  async sync(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'home_assistant', SyncShoppingList, async () => {
      const links = await ctx.containerResolver.make('homeAssistant.links')
      const items = await ctx.containerResolver.make('shoppingList.items')
      const client = await ctx.containerResolver.make('homeAssistant.client')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new SyncShoppingList(links, items, client, idGenerator, clock).execute({
        householdId: ctx.household.id,
      })
      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }
      ctx.response.json(result.value)
      return result
    }, { isError: (r) => !r.ok })
  }
}
```

- [ ] **Step 2: Run the existing functional suite for this domain**

Run: `cd backend && node ace test --files=home-assistant`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/presentation/home-assistant/ha-link.controller.ts
git commit -m "feat(backend): trace home-assistant actions"
```

---

### Task 10: Full backend regression check

**Files:** none (verification only)

- [ ] **Step 1: Run the entire backend suite**

Run: `cd backend && node ace test`
Expected: PASS, same test count as before Task 1 (`traceAction`'s own 5 tests added, nothing else changed in count)

- [ ] **Step 2: Commit** (only if this step surfaces a fix — otherwise skip; there is nothing new to commit)

---

### Task 11: `http-client.ts` — action-aware span + business-error telemetry

**Files:**
- Modify: `mobile/src/infrastructure/http/http-client.ts`
- Modify: `mobile/src/infrastructure/http/http-client.test.ts`

**Interfaces:**
- Produces: `ActionContext` (`{ action?: string; attributes?: Record<string, string | number | boolean> }`), and `apiFetch<T>(path, init?, context?: ActionContext)` / `apiFetchMultipart<T>(path, formData, context?: ActionContext)` gain the third parameter. Task 12 (`http-fridge-connector.ts`) is the consumer.

- [ ] **Step 1: Write the failing tests**

Add to `mobile/src/infrastructure/http/http-client.test.ts` (new import at the top, two new tests at the end of the file):

```typescript
import { telemetry } from '../telemetry/telemetry.js'
```

```typescript
test('apiFetch() records telemetry with the given action name when the response is not ok', async () => {
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 422,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'validation_failed', message: 'oops' } }),
  }) as unknown as typeof fetch

  await apiFetch('/api/products', { method: 'POST' }, { action: 'fridge.create_product' })

  expect(spy).toHaveBeenCalledWith(
    'action failed: validation_failed',
    expect.objectContaining({ attributes: { 'error.type': 'validation_failed', action: 'fridge.create_product' } }),
  )
  spy.mockRestore()
})

test('apiFetch() falls back to method+path as the action label when none is given', async () => {
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 500,
    ok: false,
    json: () => Promise.resolve({ error: { type: 'server_error', message: 'oops' } }),
  }) as unknown as typeof fetch

  await apiFetch('/api/whatever')

  expect(spy).toHaveBeenCalledWith(
    'action failed: server_error',
    expect.objectContaining({ attributes: { 'error.type': 'server_error', action: 'GET /api/whatever' } }),
  )
  spy.mockRestore()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && npx jest http-client.test.ts`
Expected: FAIL — `telemetry.recordError` not called (the current `apiFetch` never calls it on `!response.ok`)

- [ ] **Step 3: Modify `http-client.ts`**

Replace the whole file:

```typescript
import { Platform } from 'react-native'
import { Result } from '../../domain/shared/result.js'
import { telemetry } from '../telemetry/telemetry.js'
import { authClient } from '../auth/auth-client.js'
import { queryClient } from '../../application/shared/query-client.js'
import type { ApiError } from '../../domain/shared/api-error.js'

const API_URL = process.env.EXPO_PUBLIC_API_URL as string

/** Names the span/log with the business action it belongs to, and carries whatever entity ids the caller already knows — never free text. */
export interface ActionContext {
  action?: string
  attributes?: Record<string, string | number | boolean>
}

/**
 * The backend revoking a session mid-visit (cookie expired, signed out
 * elsewhere, server restarted with in-memory sessions) used to leave the app
 * stuck between two states forever: every protected call now 401s, but
 * nothing ever told the `(tabs)`/`(auth)` gates — both read `useSessionQuery`
 * off TanStack's cache, which nothing here refetches on its own (no
 * `AppState`/`focusManager` wiring, and the screens that hold it never
 * remount) — so `session.data` stayed the last *truthy* answer from cold
 * start and the app went on rendering protected screens against a session
 * the server had already thrown away. Not signed in, not signed out either.
 *
 * `requireAuthenticatedUser` on the backend (see `auth-context.ts`) throws
 * exactly one shape for this — `{ type: 'unauthenticated' }` — deliberately
 * distinct from `invalid_credentials` (a rejected sign-in attempt, which
 * never reaches here: it goes through `authClient.signIn.email`, not this
 * module), so this only fires for a session that *was* valid and just died.
 */
function handleUnauthenticated() {
  // Flips every gate and query reading `useSessionQuery()` to "signed out"
  // immediately — no need to re-ask the backend to confirm what it just
  // said. `(tabs)/_layout.tsx` redirects to `/(auth)/sign-in` on its next
  // render once `session.data` is `null`.
  queryClient.setQueryData(['session'], null)
  // Best-effort: also drops the now-dead cookie from SecureStore, so later
  // requests stop sending it. The gate flip above doesn't depend on this.
  authClient.signOut().catch(() => {})
}

/**
 * Wraps one outgoing call in a client span and injects `traceparent`, so the
 * span the backend opens for the same request is a child of this one. That
 * single header is the whole mobile→backend correlation mechanism: no custom
 * id, no custom protocol, just W3C trace context.
 *
 * Telemetry is entirely out of the request's way — `startClientSpan` returns
 * `null` when it is off, and `end()` cannot throw — so a missing or broken
 * observability stack changes nothing about what this function returns.
 */
async function tracedFetch(
  path: string,
  method: string,
  init: RequestInit,
  context?: ActionContext,
): Promise<Response> {
  const span = telemetry.startClientSpan(context?.action ?? `${method} ${path}`, {
    'http.request.method': method,
    // The path, never the query string: it is where ids and search terms live.
    'url.path': path.split('?')[0],
    'server.address': API_URL,
    ...context?.attributes,
  })

  // React Native's `fetch` keeps no cookie jar across requests — unlike a
  // browser, `credentials: 'include'` alone sends nothing here. better-auth's
  // Expo plugin stores the session cookie itself (SecureStore) exactly for
  // this reason, and `getCookie()` is the documented way to read it back for
  // any request that doesn't go through `authClient`'s own fetch. Without
  // this, every call below is unauthenticated on native, no matter how
  // recently the user signed in.
  //
  // Web never needed this: the browser's own cookie jar already attaches the
  // session cookie via `credentials: 'include'` below. It matters more than
  // "unneeded" — `expo-secure-store`'s web shim doesn't implement
  // `getValueWithKeyAsync` at all, so calling `getCookie()` here on web threw
  // on every single request, silently failing every `apiFetch` call.
  const cookie = Platform.OS === 'web' ? null : await authClient.getCookie()

  const headers = {
    ...(init.headers as Record<string, string>),
    ...(span ? { traceparent: span.traceparent } : null),
    ...(cookie ? { Cookie: cookie } : null),
  }

  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, headers })
    span?.end({ attributes: { 'http.response.status_code': response.status } })
    return response
  } catch (error) {
    span?.end({ error })
    // A transport failure never reaches the backend, so this is the only
    // trace of it anywhere — and it must not depend on telemetry being
    // configured. `recordError` below only fires when `span` is non-null
    // (telemetry off/unconfigured, the common case in local dev, returns
    // `null` from `startClientSpan`), which used to mean a dev running
    // without a telemetry relay saw absolutely nothing for a request that
    // never left the device — not even in the Metro console. This one
    // always prints, telemetry or not.
    console.error(`[api] ${method} ${path} failed before reaching the server`, error)
    if (span) {
      telemetry.recordError(`${method} ${path} failed before reaching the server`, {
        error,
        span,
        attributes: { 'http.request.method': method, 'url.path': path.split('?')[0] },
      })
    }
    throw error
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  context?: ActionContext,
): Promise<Result<T, ApiError>> {
  try {
    const response = await tracedFetch(
      path,
      init?.method ?? 'GET',
      {
        ...init,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...init?.headers },
      },
      context,
    )
    // A 204 always means "success, no body" — nothing to parse.
    if (response.status === 204) return Result.ok(undefined as T)
    const body = await response.json()
    if (!response.ok) {
      const error = body.error as ApiError
      // The request reached the backend, so this is not a transport failure
      // — `tracedFetch` already ended the span as "success" with the status
      // code attached, which used to leave every 4xx/5xx business error
      // invisible in traces. Recorded here instead of restructuring the
      // span's timing above.
      telemetry.recordError(`action failed: ${error.type}`, {
        attributes: { 'error.type': error.type, action: context?.action ?? `${init?.method ?? 'GET'} ${path}` },
      })
      if (error.type === 'unauthenticated') handleUnauthenticated()
      return Result.err(error)
    }
    return Result.ok(body as T)
  } catch (error) {
    // Covers two cases: `tracedFetch` already logged a pure transport
    // failure (this just adds the "here's the generic error the caller
    // sees" breadcrumb next to it); a *successful* response whose body
    // wasn't valid JSON never gets logged anywhere else at all.
    console.error(`[api] ${init?.method ?? 'GET'} ${path} could not be completed`, error)
    return Result.err({ type: 'network_error', message: 'Impossible de contacter le serveur.' })
  }
}

/**
 * Like `apiFetch`, but for a `FormData` body (the one client→server call
 * that isn't JSON: the receipt-scan image upload). No `Content-Type`
 * header is set — `fetch` derives the multipart boundary from the
 * `FormData` instance itself, and setting it manually would drop that
 * boundary.
 */
export async function apiFetchMultipart<T>(
  path: string,
  formData: FormData,
  context?: ActionContext,
): Promise<Result<T, ApiError>> {
  try {
    const response = await tracedFetch(
      path,
      'POST',
      { method: 'POST', credentials: 'include', body: formData },
      context,
    )
    if (response.status === 204) return Result.ok(undefined as T)
    const body = await response.json()
    if (!response.ok) {
      const error = body.error as ApiError
      telemetry.recordError(`action failed: ${error.type}`, {
        attributes: { 'error.type': error.type, action: context?.action ?? `POST ${path}` },
      })
      if (error.type === 'unauthenticated') handleUnauthenticated()
      return Result.err(error)
    }
    return Result.ok(body as T)
  } catch (error) {
    console.error(`[api] POST ${path} could not be completed`, error)
    return Result.err({ type: 'network_error', message: 'Impossible de contacter le serveur.' })
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile && npx jest http-client.test.ts`
Expected: PASS — all tests in the file, including the two new ones

- [ ] **Step 5: Commit**

```bash
git add mobile/src/infrastructure/http/http-client.ts mobile/src/infrastructure/http/http-client.test.ts
git commit -m "feat(mobile): name action spans and record business-error telemetry in http-client"
```

---

### Task 12: `http-fridge-connector.ts` — action name per call, `signOut()` stops throwing

**Files:**
- Modify: `mobile/src/infrastructure/http/http-fridge-connector.ts`
- Modify: `mobile/src/infrastructure/http/http-fridge-connector.test.ts`

**Interfaces:**
- Consumes: `ActionContext` from Task 11.

- [ ] **Step 1: Write the failing test**

Extend the `jest.mock('../auth/auth-client.js', ...)` factory at the top of `http-fridge-connector.test.ts` to add `signOut`, and add one new test:

```typescript
jest.mock('../auth/auth-client.js', () => ({
  authClient: {
    signIn: {
      email: jest.fn(),
    },
    signOut: jest.fn().mockResolvedValue(undefined),
    // Read by every apiFetch call (http-client.ts) to attach the session
    // cookie — unrelated to what most tests in this file exercise, but
    // still awaited on every request, so it needs a resolved value here.
    getCookie: jest.fn().mockResolvedValue(''),
  },
}))
```

```typescript
test('signOut() swallows an authClient failure and reports it instead of throwing', async () => {
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  ;(authClient.signOut as jest.Mock).mockRejectedValueOnce(new Error('network down'))

  const connector = new HttpFridgeConnector()
  await expect(connector.signOut()).resolves.toBeUndefined()

  expect(spy).toHaveBeenCalledWith(
    'identity.sign_out failed',
    expect.objectContaining({ attributes: { 'app.operation': 'identity.sign_out' } }),
  )
  spy.mockRestore()
})
```

Add the one new import this test needs, next to the existing ones at the top of the file (`authClient` is already imported there):

```typescript
import { telemetry } from '../telemetry/telemetry.js'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest http-fridge-connector.test.ts -t "signOut"`
Expected: FAIL — `connector.signOut()` rejects instead of resolving (the real `authClient.signOut()` rejection currently propagates)

- [ ] **Step 3: Modify `http-fridge-connector.ts`**

Replace the whole file:

```typescript
import { Platform } from 'react-native'
import { File } from 'expo-file-system'
import { authClient } from '../auth/auth-client.js'
import { apiFetch, apiFetchMultipart } from './http-client.js'
import { telemetry } from '../telemetry/telemetry.js'
import { Result } from '../../domain/shared/result.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'
import type { Session } from '../../domain/identity/session.js'
import type { Household } from '../../domain/identity/household.js'
import type { AuthMethod } from '../../domain/identity/auth-method.js'
import type { ApiError } from '../../domain/shared/api-error.js'
import type { ShoppingItem, CreateShoppingItemInput, UpdateShoppingItemInput } from '../../domain/shopping-list/shopping-item.js'
import type { Recipe } from '../../domain/recipe/recipe.js'
import type { Product, CreateProductInput, UpdateProductInput } from '../../domain/fridge/product.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { ProductLookupResult } from '../../domain/fridge/product-lookup-result.js'
import type { ReceiptDraft } from '../../domain/receipt/receipt-draft.js'
import type { Receipt, ImportReceiptInput } from '../../domain/receipt/receipt.js'
import type { AiSettings, AiProvider } from '../../domain/settings/ai-settings.js'
import type {
  HaLink,
  HaTodoEntity,
  SaveHaConnectionInput,
  DiscoverHaEntitiesInput,
  BindHaListInput,
} from '../../domain/home-assistant/ha-link.js'

function toSession(
  data: { user: { id: string; email: string; name: string; image?: string | null } } | null | undefined,
): Session | null {
  if (!data?.user) return null
  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      image: data.user.image ?? null,
    },
  }
}

/**
 * The auth calls below swallow their errors on purpose — a failed session
 * read must not block startup, and a failed sign-in has its own user-facing
 * message. Swallowed used to mean invisible: the errors went to
 * `console.warn`, i.e. to a device log nobody reads, carrying whatever the
 * auth client happened to put in the object.
 *
 * They now go to telemetry as an operation name plus an error *type* — never
 * the error's own message or payload, which for these particular calls can
 * contain the credentials that were being verified. The raw object is still
 * printed in development, where it is a local console and not a data store.
 */
function reportFailure(operation: string, error: unknown): void {
  if (__DEV__) console.warn(`[${operation}]`, error)
  telemetry.recordError(`${operation} failed`, { error, attributes: { 'app.operation': operation } })
}

export class HttpFridgeConnector implements FridgeConnector {
  async getSession(): Promise<Session | null> {
    try {
      const { data } = await authClient.getSession()
      return toSession(data)
    } catch (error) {
      // Return null if session check fails, this prevents blocking app startup
      reportFailure('identity.get_session', error)
      return null
    }
  }

  async getAuthMethods(): Promise<AuthMethod[]> {
    try {
      const result = await apiFetch<{ methods: AuthMethod[] }>('/api/auth/methods', undefined, {
        action: 'identity.get_auth_methods',
      })
      return result.ok ? result.value.methods : []
    } catch (error) {
      reportFailure('identity.get_auth_methods', error)
      return []
    }
  }

  async signInEmail(email: string, password: string): Promise<Result<Session, ApiError>> {
    try {
      const { error } = await authClient.signIn.email({ email, password })
      if (error) {
        return Result.err({ type: error.code ?? 'sign_in_failed', message: error.message ?? 'Connexion impossible.' })
      }
      const session = await this.getSession()
      if (!session) return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
      return Result.ok(session)
    } catch (error) {
      reportFailure('identity.sign_in_email', error)
      return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
    }
  }

  async signUpEmail(email: string, password: string, name: string): Promise<Result<Session, ApiError>> {
    try {
      const { error } = await authClient.signUp.email({ email, password, name })
      if (error) {
        return Result.err({ type: error.code ?? 'sign_up_failed', message: error.message ?? 'Inscription impossible.' })
      }
      const session = await this.getSession()
      if (!session) return Result.err({ type: 'sign_up_failed', message: 'Inscription impossible.' })
      return Result.ok(session)
    } catch (error) {
      reportFailure('identity.sign_up_email', error)
      return Result.err({ type: 'sign_up_failed', message: 'Inscription impossible.' })
    }
  }

  async signInSocial(provider: 'pocketid'): Promise<Result<Session, ApiError>> {
    try {
      // better-auth validates callbackURL as a plain path — Expo Router's
      // `(tabs)` route-group syntax isn't one (the parens fail its check
      // server-side with 403 INVALID_CALLBACK_URL, before PocketID is ever
      // reached). `onSuccess()` below does the actual in-app navigation, so
      // this only needs to be *a* valid path.
      const { error } = await authClient.signIn.social({ provider, callbackURL: '/' })
      if (error) {
        return Result.err({ type: error.code ?? 'sign_in_failed', message: error.message ?? 'Connexion impossible.' })
      }
      const session = await this.getSession()
      if (!session) return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
      return Result.ok(session)
    } catch (error) {
      reportFailure('identity.sign_in_social', error)
      return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
    }
  }

  /**
   * Swallows on purpose, like every other identity method here — a failed
   * sign-out must not strand a screen mid-navigation. Whatever went wrong
   * server-side, every caller clears its own local session state and
   * navigates to `/(auth)/sign-in` right after this resolves, so "best
   * effort, continue anyway" is the same trade `getSession` already makes.
   */
  async signOut(): Promise<void> {
    try {
      await authClient.signOut()
    } catch (error) {
      reportFailure('identity.sign_out', error)
    }
  }

  /**
   * `null` means the server said this account has no foyer. A failed read
   * **throws**, so TanStack marks the query `isError` rather than `data: null`.
   *
   * It used to answer `null` for both, and that conflation is now load-bearing
   * in the wrong direction: `(tabs)/_layout` reads this query to decide
   * whether to send someone to the onboarding, so a dropped connection in a
   * kitchen on one bar of signal would have told an existing member their
   * foyer was gone and offered them a form to create a second one. The Foyer
   * screen's own `isError` branch — three states, written precisely so a
   * failed read is not reported as "tu n'appartiens à aucun foyer" — could
   * never fire either, for the same reason.
   */
  async getHousehold(): Promise<Household | null> {
    const result = await apiFetch<{ household: Household | null }>('/api/households/mine', undefined, {
      action: 'identity.get_household',
    })
    if (!result.ok) throw new Error(result.error.message)
    return result.value.household
  }

  async createHousehold(name: string): Promise<Result<Household, ApiError>> {
    const result = await apiFetch<{ household: Household }>(
      '/api/households',
      { method: 'POST', body: JSON.stringify({ name }) },
      { action: 'identity.create_household' },
    )
    return result.ok ? Result.ok(result.value.household) : Result.err(result.error)
  }

  async joinHousehold(inviteCode: string): Promise<Result<Household, ApiError>> {
    const result = await apiFetch<{ household: Household }>(
      '/api/households/join',
      { method: 'POST', body: JSON.stringify({ inviteCode }) },
      { action: 'identity.join_household' },
    )
    return result.ok ? Result.ok(result.value.household) : Result.err(result.error)
  }

  async regenerateInviteCode(): Promise<Result<string, ApiError>> {
    const result = await apiFetch<{ inviteCode: string }>(
      '/api/households/invite-code/regenerate',
      { method: 'POST' },
      { action: 'identity.regenerate_invite_code' },
    )
    return result.ok ? Result.ok(result.value.inviteCode) : Result.err(result.error)
  }

  async removeHouseholdMember(userId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      `/api/households/members/${userId}`,
      { method: 'DELETE' },
      { action: 'identity.remove_household_member', attributes: { targetUserId: userId } },
    )
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async leaveHousehold(): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      '/api/households/leave',
      { method: 'POST' },
      { action: 'identity.leave_household' },
    )
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async getShoppingItems(): Promise<ShoppingItem[]> {
    const result = await apiFetch<{ items: ShoppingItem[] }>('/api/shopping-items', undefined, {
      action: 'shopping_list.get_items',
    })
    return result.ok ? result.value.items : []
  }

  async createShoppingItem(input: CreateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const result = await apiFetch<{ item: ShoppingItem }>(
      '/api/shopping-items',
      { method: 'POST', body: JSON.stringify(input) },
      { action: 'shopping_list.create_item' },
    )
    return result.ok ? Result.ok(result.value.item) : Result.err(result.error)
  }

  async updateShoppingItem(itemId: string, patch: UpdateShoppingItemInput): Promise<Result<ShoppingItem, ApiError>> {
    const result = await apiFetch<{ item: ShoppingItem }>(
      `/api/shopping-items/${itemId}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      { action: 'shopping_list.update_item', attributes: { itemId } },
    )
    return result.ok ? Result.ok(result.value.item) : Result.err(result.error)
  }

  async deleteShoppingItem(itemId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      `/api/shopping-items/${itemId}`,
      { method: 'DELETE' },
      { action: 'shopping_list.delete_item', attributes: { itemId } },
    )
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async getRecipes(): Promise<Recipe[]> {
    const result = await apiFetch<{ recipes: Recipe[] }>('/api/recipes', undefined, { action: 'recipe.get_recipes' })
    return result.ok ? result.value.recipes : []
  }

  async getRecipe(recipeId: string): Promise<Recipe | null> {
    const result = await apiFetch<{ recipe: Recipe }>(`/api/recipes/${recipeId}`, undefined, {
      action: 'recipe.get_recipe',
      attributes: { recipeId },
    })
    return result.ok ? result.value.recipe : null
  }

  async generateRecipes(prompt?: string): Promise<Result<Recipe[], ApiError>> {
    const result = await apiFetch<{ recipes: Recipe[] }>(
      '/api/recipes/generate',
      { method: 'POST', body: JSON.stringify(prompt ? { prompt } : {}) },
      { action: 'recipe.generate_recipes' },
    )
    return result.ok ? Result.ok(result.value.recipes) : Result.err(result.error)
  }

  async cookRecipe(recipeId: string, productIds: string[]): Promise<Result<Recipe, ApiError>> {
    const result = await apiFetch<{ recipe: Recipe }>(
      `/api/recipes/${recipeId}/cooked`,
      { method: 'POST', body: JSON.stringify({ productIds }) },
      { action: 'recipe.cook_recipe', attributes: { recipeId } },
    )
    return result.ok ? Result.ok(result.value.recipe) : Result.err(result.error)
  }

  async deleteRecipe(recipeId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      `/api/recipes/${recipeId}`,
      { method: 'DELETE' },
      { action: 'recipe.delete_recipe', attributes: { recipeId } },
    )
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async getProducts(params?: { location?: LocationValue; expiringWithinDays?: number }): Promise<Product[]> {
    const query = new URLSearchParams()
    if (params?.location) query.set('location', params.location)
    if (params?.expiringWithinDays) query.set('expiringWithinDays', String(params.expiringWithinDays))
    const qs = query.toString()
    const result = await apiFetch<{ products: Product[] }>(`/api/products${qs ? `?${qs}` : ''}`, undefined, {
      action: 'fridge.get_products',
    })
    return result.ok ? result.value.products : []
  }

  async getProduct(productId: string): Promise<Product | null> {
    const result = await apiFetch<{ product: Product }>(`/api/products/${productId}`, undefined, {
      action: 'fridge.get_product',
      attributes: { productId },
    })
    return result.ok ? result.value.product : null
  }

  async createProduct(input: CreateProductInput): Promise<Result<Product, ApiError>> {
    const result = await apiFetch<{ product: Product }>(
      '/api/products',
      { method: 'POST', body: JSON.stringify(input) },
      { action: 'fridge.create_product' },
    )
    return result.ok ? Result.ok(result.value.product) : Result.err(result.error)
  }

  async updateProduct(productId: string, patch: UpdateProductInput): Promise<Result<Product, ApiError>> {
    const result = await apiFetch<{ product: Product }>(
      `/api/products/${productId}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      { action: 'fridge.update_product', attributes: { productId } },
    )
    return result.ok ? Result.ok(result.value.product) : Result.err(result.error)
  }

  async deleteProduct(productId: string): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      `/api/products/${productId}`,
      { method: 'DELETE' },
      { action: 'fridge.delete_product', attributes: { productId } },
    )
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async getExpiringSoonProducts(days?: number): Promise<Product[]> {
    const qs = days ? `?days=${days}` : ''
    const result = await apiFetch<{ products: Product[] }>(`/api/products/expiring-soon${qs}`, undefined, {
      action: 'fridge.get_expiring_soon_products',
    })
    return result.ok ? result.value.products : []
  }

  /**
   * `null` means the barcode is real but OpenFoodFacts has nothing for it —
   * a legitimate outcome the form turns into "remplis les champs à la main".
   * A failed request **throws**, same convention as `getHousehold`: it must
   * not collapse into that same `null`, or a dropped connection reads as
   * "this product doesn't exist" instead of "we couldn't check".
   */
  async lookupProductByBarcode(barcode: string): Promise<ProductLookupResult | null> {
    const result = await apiFetch<{ result: ProductLookupResult | null }>(
      `/api/products/lookup?barcode=${encodeURIComponent(barcode)}`,
      undefined,
      { action: 'fridge.lookup_product' },
    )
    if (!result.ok) throw new Error(result.error.message)
    return result.value.result
  }

  async scanReceipt(imageUri: string): Promise<Result<ReceiptDraft, ApiError>> {
    const formData = new FormData()
    // The old RN `{ uri, name, type }` shim is dead: since Expo SDK 53,
    // `expo/fetch` replaces both `fetch` and `FormData.prototype.append`
    // globally (native included, not just web — see
    // `expo/src/winter/runtime.native.ts` and `FormData.ts`), and its
    // WinterCG-style `FormData` only accepts a string or a real
    // Blob/File-like part with a `.bytes()`/Blob interface. Appending the
    // shim object now throws "Unsupported FormDataPart implementation" —
    // silently, with the request never leaving the device, no matter the
    // platform.
    if (Platform.OS === 'web') {
      // `imageUri` here is a `blob:`/`data:` URL the picker/camera already
      // produced in-memory — re-fetching it just hands back the same bytes
      // as a real Blob. `expo-file-system`'s `File` (below) is native-only.
      const blob = await (await fetch(imageUri)).blob()
      formData.append('image', blob, 'receipt.jpg')
    } else {
      // `File` implements the `Blob` interface, so it's exactly the kind of
      // part `expo/fetch`'s `FormData` expects — reading a local `file://`
      // URI into a real Blob without a manual `fetch`+`.blob()` round-trip,
      // which isn't guaranteed to work against `file://` on the new fetch.
      formData.append('image', new File(imageUri), 'receipt.jpg')
    }
    const result = await apiFetchMultipart<{ draft: ReceiptDraft }>('/api/receipts/scan', formData, {
      action: 'receipt.scan',
    })
    return result.ok ? Result.ok(result.value.draft) : Result.err(result.error)
  }

  async importReceipt(input: ImportReceiptInput): Promise<Result<{ receipt: Receipt; products: Product[] }, ApiError>> {
    const result = await apiFetch<{ receipt: Receipt; products: Product[] }>(
      '/api/receipts/import',
      { method: 'POST', body: JSON.stringify(input) },
      { action: 'receipt.import' },
    )
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async getReceipts(): Promise<Receipt[]> {
    const result = await apiFetch<{ receipts: Receipt[] }>('/api/receipts', undefined, {
      action: 'receipt.get_receipts',
    })
    return result.ok ? result.value.receipts : []
  }

  async getReceipt(receiptId: string): Promise<{ receipt: Receipt; products: Product[] } | null> {
    const result = await apiFetch<{ receipt: Receipt; products: Product[] }>(`/api/receipts/${receiptId}`, undefined, {
      action: 'receipt.get_receipt',
      attributes: { receiptId },
    })
    return result.ok ? result.value : null
  }

  async getAiSettings(): Promise<AiSettings | null> {
    const result = await apiFetch<AiSettings>('/api/settings/ai', undefined, { action: 'settings.get_ai_settings' })
    return result.ok ? result.value : null
  }

  async setActiveAiProvider(provider: AiProvider): Promise<Result<AiSettings, ApiError>> {
    const result = await apiFetch<AiSettings>(
      '/api/settings/ai',
      { method: 'PATCH', body: JSON.stringify({ provider }) },
      { action: 'settings.set_active_ai_provider' },
    )
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async getHaLink(): Promise<HaLink | null> {
    const result = await apiFetch<HaLink>('/api/settings/home-assistant', undefined, {
      action: 'home_assistant.get_link',
    })
    if (__DEV__) {
      // `JSON.stringify`, not the object itself: RN's console truncates a
      // nested array of objects (Vine's `details`) to `[Object]`, which is
      // exactly the part worth reading when the error is `validation_failed`.
      console.log('[home_assistant.get_link]', result.ok ? { configured: result.value.configured } : JSON.stringify({ error: result.error }))
    }
    return result.ok ? result.value : null
  }

  async saveHaConnection(input: SaveHaConnectionInput): Promise<Result<HaLink, ApiError>> {
    // Never the token, per the same rule the backend client follows.
    if (__DEV__) console.log('[home_assistant.save_connection] connecting', { instanceUrl: input.instanceUrl })
    const result = await apiFetch<HaLink>(
      '/api/settings/home-assistant',
      { method: 'PUT', body: JSON.stringify(input) },
      { action: 'home_assistant.save_connection' },
    )
    if (__DEV__) {
      console.log('[home_assistant.save_connection]', result.ok ? 'connected' : JSON.stringify({ error: result.error }))
    }
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async discoverHaTodoEntities(input: DiscoverHaEntitiesInput): Promise<Result<HaTodoEntity[], ApiError>> {
    if (__DEV__) console.log('[home_assistant.discover] connecting', { instanceUrl: input.instanceUrl })
    const result = await apiFetch<{ entities: HaTodoEntity[] }>(
      '/api/settings/home-assistant/discover',
      { method: 'POST', body: JSON.stringify(input) },
      { action: 'home_assistant.discover' },
    )
    if (__DEV__) {
      console.log('[home_assistant.discover]', result.ok ? { entities: result.value.entities.length } : JSON.stringify({ error: result.error }))
    }
    return result.ok ? Result.ok(result.value.entities) : Result.err(result.error)
  }

  async bindHaList(input: BindHaListInput): Promise<Result<HaLink, ApiError>> {
    const result = await apiFetch<HaLink>(
      '/api/settings/home-assistant',
      { method: 'PATCH', body: JSON.stringify(input) },
      { action: 'home_assistant.bind_list' },
    )
    if (__DEV__) console.log('[home_assistant.bind_list]', result.ok ? { entity: input.todoEntityId } : JSON.stringify({ error: result.error }))
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async unlinkHa(): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>(
      '/api/settings/home-assistant',
      { method: 'DELETE' },
      { action: 'home_assistant.unlink' },
    )
    if (__DEV__) console.log('[home_assistant.unlink]', result.ok ? 'ok' : { error: result.error })
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async syncShoppingListWithHa(): Promise<Result<{ synced: boolean }, ApiError>> {
    const result = await apiFetch<{ synced: boolean }>(
      '/api/shopping-items/sync',
      { method: 'POST' },
      { action: 'home_assistant.sync_shopping_list' },
    )
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile && npx jest http-fridge-connector.test.ts`
Expected: PASS — every existing test plus the new `signOut()` one

- [ ] **Step 5: Commit**

```bash
git add mobile/src/infrastructure/http/http-fridge-connector.ts mobile/src/infrastructure/http/http-fridge-connector.test.ts
git commit -m "feat(mobile): name every connector action and stop signOut() from throwing"
```

---

### Task 13: `app-storage.ts` — local storage failures

**Files:**
- Modify: `mobile/src/presentation/shared/app-storage.ts`
- Create: `mobile/src/presentation/shared/app-storage.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// mobile/src/presentation/shared/app-storage.test.ts
import * as SecureStore from 'expo-secure-store'
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
import { readSetting, writeSetting, clearSetting } from './app-storage.js'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

afterEach(() => {
  jest.clearAllMocks()
})

test('readSetting() records telemetry and returns null when SecureStore throws', async () => {
  ;(SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('keychain locked'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})

  const result = await readSetting('onboarding_tour_seen')

  expect(result).toBeNull()
  expect(spy).toHaveBeenCalledWith(
    'local storage read failed',
    expect.objectContaining({ attributes: { 'app.operation': 'storage.read', key: 'onboarding_tour_seen' } }),
  )
  spy.mockRestore()
})

test('writeSetting() records telemetry but does not throw when SecureStore throws', async () => {
  ;(SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('keychain locked'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})

  await expect(writeSetting('onboarding_tour_seen', 'true')).resolves.toBeUndefined()

  expect(spy).toHaveBeenCalledWith(
    'local storage write failed',
    expect.objectContaining({ attributes: { 'app.operation': 'storage.write', key: 'onboarding_tour_seen' } }),
  )
  spy.mockRestore()
})

test('clearSetting() records telemetry but does not throw when SecureStore throws', async () => {
  ;(SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('keychain locked'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})

  await expect(clearSetting('onboarding_tour_seen')).resolves.toBeUndefined()

  expect(spy).toHaveBeenCalledWith(
    'local storage clear failed',
    expect.objectContaining({ attributes: { 'app.operation': 'storage.clear', key: 'onboarding_tour_seen' } }),
  )
  spy.mockRestore()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && npx jest app-storage.test.ts`
Expected: FAIL — `telemetry.recordError` never called (the current implementation swallows silently)

- [ ] **Step 3: Modify `app-storage.ts`**

```typescript
/**
 * One small key/value store that answers on all three platforms.
 *
 * `expo-secure-store` is already a dependency (it backs the auth client's
 * session storage) but it has **no web implementation** — calling it from a
 * browser build throws rather than returning null, so a screen that stored a
 * flag through it would work on a phone and crash the web build silently
 * inside a promise nobody awaited. Web falls back to `localStorage`.
 *
 * Every call is wrapped: a private window, a locked keychain, or storage
 * disabled by policy must degrade to "we don't know", never to a thrown error
 * on a first-run path. "We don't know" is the safe answer for everything kept
 * here — a tour shows again, a remembered invite code is simply retyped.
 */
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'

const IS_WEB = Platform.OS === 'web'

export async function readSetting(key: string): Promise<string | null> {
  try {
    if (IS_WEB) return globalThis.localStorage?.getItem(key) ?? null
    return await SecureStore.getItemAsync(key)
  } catch (error) {
    telemetry.recordError('local storage read failed', {
      error,
      attributes: { 'app.operation': 'storage.read', key },
    })
    return null
  }
}

export async function writeSetting(key: string, value: string): Promise<void> {
  try {
    if (IS_WEB) globalThis.localStorage?.setItem(key, value)
    else await SecureStore.setItemAsync(key, value)
  } catch (error) {
    // A flag we could not persist costs a repeated tour, not a broken screen.
    telemetry.recordError('local storage write failed', {
      error,
      attributes: { 'app.operation': 'storage.write', key },
    })
  }
}

export async function clearSetting(key: string): Promise<void> {
  try {
    if (IS_WEB) globalThis.localStorage?.removeItem(key)
    else await SecureStore.deleteItemAsync(key)
  } catch (error) {
    // Same trade as above.
    telemetry.recordError('local storage clear failed', {
      error,
      attributes: { 'app.operation': 'storage.clear', key },
    })
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile && npx jest app-storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/presentation/shared/app-storage.ts mobile/src/presentation/shared/app-storage.test.ts
git commit -m "feat(mobile): record telemetry on local storage failures"
```

---

### Task 14: `invite-share-card.tsx` — share/copy failures

**Files:**
- Modify: `mobile/src/presentation/identity/invite-share-card.tsx`
- Create: `mobile/src/presentation/identity/invite-share-card.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// mobile/src/presentation/identity/invite-share-card.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Share } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { ThemeProvider } from '../shared/theme-provider.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
import { InviteShareCard } from './invite-share-card.js'

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
// `showQr` defaults to `false` so this never actually renders, but the
// import itself still runs at module-load time — `react-native-qrcode-svg`
// draws through `react-native-svg`, which jest can't resolve without a
// mock, same convention as `CameraView` in barcode-scanner-screen.test.tsx.
jest.mock('react-native-qrcode-svg', () => 'QRCode')

function Harness({ onFeedback }: { onFeedback: (message: string) => void }) {
  const palette = useSoftPalette()
  return (
    <InviteShareCard
      householdName="Le foyer de Florian"
      inviteCode="ABCD1234"
      palette={palette}
      regenerating={false}
      onRegenerate={jest.fn()}
      onFeedback={onFeedback}
    />
  )
}

afterEach(() => {
  jest.clearAllMocks()
})

test('a share-sheet failure records telemetry and shows the failure hint', async () => {
  jest.spyOn(Share, 'share').mockRejectedValue(new Error('sheet unavailable'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  const onFeedback = jest.fn()

  render(
    <ThemeProvider>
      <Harness onFeedback={onFeedback} />
    </ThemeProvider>,
  )
  fireEvent.press(screen.getByTestId('household-invite-share'))

  await waitFor(() => expect(onFeedback).toHaveBeenCalledWith('Le partage n’a pas pu s’ouvrir.'))
  expect(spy).toHaveBeenCalledWith(
    'share sheet failed to open',
    expect.objectContaining({ attributes: { 'app.operation': 'identity.share_invite' } }),
  )
  spy.mockRestore()
})

test('a clipboard write failure records telemetry and shows the failure hint', async () => {
  ;(Clipboard.setStringAsync as jest.Mock).mockRejectedValue(new Error('clipboard unavailable'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  const onFeedback = jest.fn()

  render(
    <ThemeProvider>
      <Harness onFeedback={onFeedback} />
    </ThemeProvider>,
  )
  fireEvent.press(screen.getByTestId('household-invite-copy'))

  await waitFor(() => expect(onFeedback).toHaveBeenCalledWith('Impossible de copier le code.'))
  expect(spy).toHaveBeenCalledWith(
    'clipboard write failed',
    expect.objectContaining({ attributes: { 'app.operation': 'identity.copy_invite' } }),
  )
  spy.mockRestore()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && npx jest invite-share-card.test.tsx`
Expected: FAIL — `telemetry.recordError` never called

- [ ] **Step 3: Modify `invite-share-card.tsx`**

Add the import next to the existing ones:

```typescript
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
```

Replace `handleShare`/`handleCopy`:

```typescript
  async function handleShare() {
    try {
      await Share.share({ message: buildShareMessage(householdName, inviteCode) })
    } catch (error) {
      telemetry.recordError('share sheet failed to open', {
        error,
        attributes: { 'app.operation': 'identity.share_invite' },
      })
      onFeedback('Le partage n’a pas pu s’ouvrir.')
    }
  }

  async function handleCopy() {
    const ok = await Clipboard.setStringAsync(inviteCode).catch((error) => {
      telemetry.recordError('clipboard write failed', {
        error,
        attributes: { 'app.operation': 'identity.copy_invite' },
      })
      return false
    })
    onFeedback(ok ? 'Code copié.' : 'Impossible de copier le code.')
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile && npx jest invite-share-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/presentation/identity/invite-share-card.tsx mobile/src/presentation/identity/invite-share-card.test.tsx
git commit -m "feat(mobile): record telemetry on invite share/copy failures"
```

---

### Task 15: `threshold-screen.tsx` — clipboard paste failure

**Files:**
- Modify: `mobile/src/presentation/onboarding/threshold-screen.tsx`
- Modify: `mobile/src/presentation/onboarding/threshold-screen.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `threshold-screen.test.tsx` (after the existing `renderThreshold` helper):

```typescript
import * as Clipboard from 'expo-clipboard'
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
```

```typescript
test('a clipboard read failure records telemetry and shows the empty-clipboard hint', async () => {
  ;(Clipboard.getStringAsync as jest.Mock).mockRejectedValueOnce(new Error('clipboard unavailable'))
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})

  await renderThreshold()
  fireEvent.press(screen.getByTestId('threshold-paste'))

  await waitFor(() =>
    expect(spy).toHaveBeenCalledWith(
      'clipboard read failed',
      expect.objectContaining({ attributes: { 'app.operation': 'identity.paste_invite' } }),
    ),
  )
  spy.mockRestore()
})
```

(`fireEvent`, `screen`, `waitFor` are already imported by the existing file from `@testing-library/react-native`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest threshold-screen.test.tsx -t "clipboard read failure"`
Expected: FAIL — `telemetry.recordError` never called

- [ ] **Step 3: Modify `threshold-screen.tsx`**

Add the import after `import * as Clipboard from 'expo-clipboard'`:

```typescript
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
```

Replace `handlePaste`:

```typescript
  async function handlePaste() {
    // `parseInviteCode`, not `normalizeInviteCode`: what people copy is the
    // whole share message, and normalizing that returns its first eight
    // letters — `REJOINSN` for a message beginning "Rejoins-nous".
    const clip = await Clipboard.getStringAsync().catch((error) => {
      telemetry.recordError('clipboard read failed', {
        error,
        attributes: { 'app.operation': 'identity.paste_invite' },
      })
      return ''
    })
    const parsed = parseInviteCode(clip ?? '')
    if (!parsed) {
      showHint('Pas de code dans le presse-papier.')
      return
    }
    setCode(parsed)
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile && npx jest threshold-screen.test.tsx`
Expected: PASS — every existing test in the file plus the new one

- [ ] **Step 5: Commit**

```bash
git add mobile/src/presentation/onboarding/threshold-screen.tsx mobile/src/presentation/onboarding/threshold-screen.test.tsx
git commit -m "feat(mobile): record telemetry on invite-code paste failure"
```

---

### Task 16: `barcode-scanner-screen.tsx` — navigation-fallback failure

**Files:**
- Modify: `mobile/src/presentation/fridge/barcode-scanner-screen.tsx`
- Modify: `mobile/src/presentation/fridge/barcode-scanner-screen.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `barcode-scanner-screen.test.tsx`:

```typescript
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
```

```typescript
test('a router.replace failure in create mode records telemetry and falls back to the fridge tab', async () => {
  const spy = jest.spyOn(telemetry, 'recordError').mockImplementation(() => {})
  ;(router.replace as jest.Mock).mockImplementationOnce(() => {
    throw new Error('empty stack')
  })

  await render(
    <ThemeProvider>
      <BarcodeScannerScreen mode="create" />
    </ThemeProvider>,
  )

  const camera = screen.getByTestId('fridge-barcode-camera')
  await act(async () => {
    camera.props.onBarcodeScanned({ data: '3017620422003' })
  })

  expect(spy).toHaveBeenCalledWith(
    'barcode scan navigation failed',
    expect.objectContaining({ attributes: { 'app.operation': 'fridge.barcode_scan_navigate' } }),
  )
  expect(router.replace).toHaveBeenLastCalledWith('/(tabs)/fridge')
  spy.mockRestore()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npx jest barcode-scanner-screen.test.tsx -t "router.replace failure"`
Expected: FAIL — `telemetry.recordError` never called

- [ ] **Step 3: Modify `barcode-scanner-screen.tsx`**

Add the import next to the existing ones:

```typescript
import { telemetry } from '../../infrastructure/telemetry/telemetry.js'
```

Replace the `try`/`catch` inside `handleBarcodeScanned`:

```typescript
    try {
      router.replace({ pathname: '/(tabs)/fridge/new', params: { prefillBarcode: data } })
    } catch (error) {
      // If router.replace fails (empty stack case), fall back to home route
      telemetry.recordError('barcode scan navigation failed', {
        error,
        attributes: { 'app.operation': 'fridge.barcode_scan_navigate' },
      })
      router.replace('/(tabs)/fridge')
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile && npx jest barcode-scanner-screen.test.tsx`
Expected: PASS — every existing test in the file plus the new one

- [ ] **Step 5: Commit**

```bash
git add mobile/src/presentation/fridge/barcode-scanner-screen.tsx mobile/src/presentation/fridge/barcode-scanner-screen.test.tsx
git commit -m "feat(mobile): record telemetry on barcode-scan navigation fallback"
```

---

### Task 17: Full mobile regression check

**Files:** none (verification only)

- [ ] **Step 1: Run the entire mobile suite**

Run: `cd mobile && npx jest`
Expected: PASS, no other file's tests changed behavior

- [ ] **Step 2: Commit** (only if this step surfaces a fix — otherwise skip)

---

### Task 18: Final full-repo verification

**Files:** none (verification only)

- [ ] **Step 1: Run both suites one more time from a clean state**

Run: `cd backend && node ace test && cd ../mobile && npx jest`
Expected: PASS, both sides, zero skipped/pending

- [ ] **Step 2: Confirm the design's own checklist**

Re-read `docs/superpowers/specs/2026-09-12-observability-action-tracing-design.md` §1–§7 against the diff (`git diff main --stat`) — every backend controller and the two mobile choke points should appear; nothing outside `Global Constraints`' allowlist (ids/enums/durations/error types, no free text) should appear in any new log/telemetry call.

- [ ] **Step 3: Done** — no commit, this task is a read-only gate.
