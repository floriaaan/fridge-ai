# Product outcome (consumed / discarded) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record how every product leaves the garde-manger — consumed or discarded (with an optional reason), whole or partial — in an append-only `product_outcome` log, so waste statistics have data to read. Data-entry mistakes keep using plain `DELETE` and are not logged.

**Architecture:** Backend first, mobile second. In the `fridge` bounded context: two VOs (`OutcomeKind`, `DiscardReason`), a `ProductOutcome` entity snapshotting the product, `Product.takeOut()` owning the stock arithmetic and the price prorata (new `initial_quantity` column), and `ProductRepository.recordOutcome()` writing the log row and mutating stock in one transaction. A new `RecordProductOutcome` use-case behind `POST /api/products/:id/outcomes`; `CookRecipe` switches from `products.delete()` to the same path. On mobile: one connector method, one mutation, and a two-step `ProductExitSheet` (choose → discard details) shared by the detail screen and the list's multi-select.

**Tech Stack:** AdonisJS 7 + Lucid + Postgres, VineJS, Japa; Expo (expo-router), TanStack Query, Tamagui, Jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-09-13-product-outcome-design.md`
**ADR:** `docs/adr/0012-journal-des-sorties-produit.md`

## Global Constraints

- No existing product read path changes (list, expiring-soon, dashboard, recipes). The `product` row is still deleted or decremented exactly as before; the log is additive.
- `DELETE /api/products/:id` and `POST /api/recipes/:id/cooked` keep their HTTP contracts byte-for-byte.
- The outcome row and the stock mutation are atomic (`db.transaction`). The stock mutation runs **first** inside the transaction so a failing log insert rolls it back — the repository test proves it.
- The snapshot is the product *as it was before* the take-out, except `quantity`, which is the part taken out.
- Price prorata: `round2(price × amount / initialQuantity)`; `null` when the product has no price.
- `discardReason` with `kind = 'consumed'` is a validation error (400), both in the use-case and as a DB `CHECK`.
- Every new backend action goes through `traceAction` (`action: 'fridge.record_product_outcome'`); every new mobile HTTP call passes the same `action` to `apiFetch` with `attributes: { 'entity.id': productId }`.
- Mobile: no optimistic UI — await the mutation, then the caller invalidates `['products']` (and `['product', id]` on the detail screen), same as today's delete/update callers.
- Presentation code follows `mobile/DESIGN.md`: every `Pressable` has `style={pointerCursor}`, an `accessibilityRole` and an `accessibilityLabel`; a row of `Chip`s uses `gap="$3"`; no borders.
- Commit after each task. Commit messages in English, conventional-commit prefix (`feat(backend):`, `feat(mobile):`, `docs:`), ending with the session attribution lines.

---

## Task 1: Migrations — `product.initial_quantity`, `product_outcome` table

**Files:**
- Create: `backend/database/migrations/1785200000014_add_initial_quantity_to_product_table.ts`
- Create: `backend/database/migrations/1785200000015_create_product_outcome_table.ts`

- [ ] **Step 1: `initial_quantity` migration**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The largest quantity a product is known to have had — what its `price` pays for.
 *
 * `price` on `product` is the receipt line total for the quantity bought. Once
 * a product can leave the garde-manger one unit at a time (ADR-0012), the value
 * of "2 yaourts jetés" is `price × 2 / initial_quantity`, and `quantity` alone
 * can no longer answer it: it has already gone down.
 *
 * Backfilled from `quantity`. Products already partly eaten before this
 * migration get an `initial_quantity` that is too small, so their partial
 * outcomes are overvalued — there is no history to rebuild it from.
 */
export default class extends BaseSchema {
  protected tableName = 'product'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('initial_quantity').nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`UPDATE "product" SET "initial_quantity" = "quantity"`)
      await db.rawQuery(`ALTER TABLE "product" ALTER COLUMN "initial_quantity" SET NOT NULL`)
      await db.rawQuery(
        `ALTER TABLE "product" ADD CONSTRAINT "product_initial_quantity_covers_quantity" CHECK ("initial_quantity" >= "quantity")`,
      )
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('initial_quantity')
    })
  }
}
```

- [ ] **Step 2: `product_outcome` migration**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per product leaving the garde-manger — eaten or thrown away (ADR-0012).
 *
 * A log, not columns on `product`: the product row is usually deleted in the
 * same transaction, and a partial exit ("2 yaourts sur 6") is several facts
 * about one product. Everything a statistic needs is snapshotted here so no
 * read ever joins back to a row that no longer exists — which is also why
 * `product_id` carries no foreign key.
 *
 * Data-entry mistakes are not outcomes and never reach this table.
 */
export default class extends BaseSchema {
  protected tableName = 'product_outcome'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('product_id').notNullable()
      // The member may leave the foyer; what happened to the product stays.
      table.text('recorded_by').nullable().references('id').inTable('user').onDelete('SET NULL')
      table.text('recipe_id').nullable().references('id').inTable('recipe').onDelete('SET NULL')
      table.text('kind').notNullable().checkIn(['consumed', 'discarded'])
      table.text('discard_reason').nullable().checkIn(['expired', 'spoiled', 'disliked', 'other'])
      table.text('product_name').notNullable()
      table.text('category').notNullable()
      table.specificType('categories', 'text[]').nullable()
      table.text('location').notNullable().checkIn(['fridge', 'freezer', 'pantry'])
      table.integer('amount').notNullable()
      table.text('unit').notNullable()
      table.decimal('price', 10, 2).nullable()
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.timestamp('occurred_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.index(['household_id', 'occurred_at'])
      table.index('product_id')
    })

    this.defer(async (db) => {
      await db.rawQuery(
        `ALTER TABLE "product_outcome" ADD CONSTRAINT "product_outcome_amount_positive" CHECK ("amount" > 0)`,
      )
      await db.rawQuery(
        `ALTER TABLE "product_outcome" ADD CONSTRAINT "product_outcome_reason_only_when_discarded" CHECK ("discard_reason" IS NULL OR "kind" = 'discarded')`,
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

- [ ] **Step 3: Run and roll back once**

Run: `task db:migrate && task db:rollback && task db:migrate`
Expected: both migrations apply, roll back, and re-apply without error.

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/1785200000014_add_initial_quantity_to_product_table.ts backend/database/migrations/1785200000015_create_product_outcome_table.ts
git commit -m "feat(backend): add product.initial_quantity and the product_outcome log table"
```

---

## Task 2: Domain — `OutcomeKind`, `DiscardReason`, `Product.initialQuantity` + `takeOut()`, `ProductOutcome`

**Files:**
- Create: `backend/src/domain/fridge/outcome-kind.vo.ts`
- Create: `backend/src/domain/fridge/discard-reason.vo.ts`
- Create: `backend/src/domain/fridge/product-outcome.entity.ts`
- Modify: `backend/src/domain/fridge/product.entity.ts`
- Create: `backend/tests/unit/domain/fridge/outcome-kind.vo.spec.ts`
- Create: `backend/tests/unit/domain/fridge/discard-reason.vo.spec.ts`
- Create: `backend/tests/unit/domain/fridge/product-outcome.entity.spec.ts`
- Modify: `backend/tests/unit/domain/fridge/product.entity.spec.ts`

**Interfaces:**
- Produces: `OutcomeKind` (`create(raw)`, `consumed()`, `discarded()`, `.value`), `DiscardReason` (`create(raw)`, `.value`), `Product.initialQuantity`, `Product.takeOut(amount, at): Result<TakeOut, ValidationError>` with `TakeOut = { remaining: Product | null; taken: Quantity; price: number | null }`, `ProductOutcome.fromProduct(product, params)`.

- [ ] **Step 1: Write the failing VO tests**

`backend/tests/unit/domain/fridge/outcome-kind.vo.spec.ts`:

```ts
import { test } from '@japa/runner'
import { OutcomeKind } from '#domain/fridge/outcome-kind.vo'

test.group('OutcomeKind', () => {
  test('accepts consumed and discarded', ({ assert }) => {
    for (const raw of ['consumed', 'discarded']) {
      const result = OutcomeKind.create(raw)
      assert.isTrue(result.ok)
      if (result.ok) assert.equal(result.value.value, raw)
    }
  })

  test('rejects anything else, including the correction a DELETE stands for', ({ assert }) => {
    const result = OutcomeKind.create('deleted')
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error.field, 'kind')
  })
})
```

`backend/tests/unit/domain/fridge/discard-reason.vo.spec.ts`:

```ts
import { test } from '@japa/runner'
import { DiscardReason } from '#domain/fridge/discard-reason.vo'

test.group('DiscardReason', () => {
  test('accepts the four reasons', ({ assert }) => {
    for (const raw of ['expired', 'spoiled', 'disliked', 'other']) {
      assert.isTrue(DiscardReason.create(raw).ok)
    }
  })

  test('rejects an unknown reason', ({ assert }) => {
    const result = DiscardReason.create('moldy')
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error.field, 'discardReason')
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd backend && node ace test unit --files="tests/unit/domain/fridge/outcome-kind.vo.spec.ts" --files="tests/unit/domain/fridge/discard-reason.vo.spec.ts"`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the VOs**

`backend/src/domain/fridge/outcome-kind.vo.ts`:

```ts
import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export type OutcomeKindValue = 'consumed' | 'discarded'

const VALID_KINDS: readonly OutcomeKindValue[] = ['consumed', 'discarded']

interface OutcomeKindProps {
  value: OutcomeKindValue
}

/**
 * How a product left the garde-manger. A data-entry correction is deliberately
 * not a kind: it is a plain DELETE and writes no outcome (ADR-0012).
 */
export class OutcomeKind extends ValueObject<OutcomeKindProps> {
  private constructor(props: OutcomeKindProps) {
    super(props)
  }

  static create(raw: string): Result<OutcomeKind, ValidationError> {
    if (!VALID_KINDS.includes(raw as OutcomeKindValue)) {
      return Result.err({ field: 'kind', message: `"${raw}" n'est pas une sortie valide.` })
    }
    return Result.ok(new OutcomeKind({ value: raw as OutcomeKindValue }))
  }

  static consumed(): OutcomeKind {
    return new OutcomeKind({ value: 'consumed' })
  }

  static discarded(): OutcomeKind {
    return new OutcomeKind({ value: 'discarded' })
  }

  get value(): OutcomeKindValue {
    return this.props.value
  }
}
```

`backend/src/domain/fridge/discard-reason.vo.ts`:

```ts
import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export type DiscardReasonValue = 'expired' | 'spoiled' | 'disliked' | 'other'

const VALID_REASONS: readonly DiscardReasonValue[] = ['expired', 'spoiled', 'disliked', 'other']

interface DiscardReasonProps {
  value: DiscardReasonValue
}

/** Why a product was thrown away. Always optional — see the spec's decision 3. */
export class DiscardReason extends ValueObject<DiscardReasonProps> {
  private constructor(props: DiscardReasonProps) {
    super(props)
  }

  static create(raw: string): Result<DiscardReason, ValidationError> {
    if (!VALID_REASONS.includes(raw as DiscardReasonValue)) {
      return Result.err({ field: 'discardReason', message: `"${raw}" n'est pas une raison valide.` })
    }
    return Result.ok(new DiscardReason({ value: raw as DiscardReasonValue }))
  }

  get value(): DiscardReasonValue {
    return this.props.value
  }
}
```

- [ ] **Step 4: Run the VO tests**

Run: same command as Step 2.
Expected: PASS.

- [ ] **Step 5: Write the failing `Product` tests**

Append to `backend/tests/unit/domain/fridge/product.entity.spec.ts`. First extend `buildProduct` so tests can set quantity and price without touching the existing callers:

```ts
function buildProduct(
  expiresAt: Date | null = null,
  overrides: Partial<{ amount: number; price: number | null }> = {},
) {
  const quantity = Quantity.create(overrides.amount ?? 1, 'L')
  const location = Location.create('fridge')
  if (!quantity.ok || !location.ok) throw new Error('unreachable')

  return Product.create({
    id: 'p_1',
    householdId: 'h_1',
    name: 'Lait',
    quantity: quantity.value,
    location: location.value,
    category: 'Produits laitiers',
    expiresAt,
    price: overrides.price ?? null,
    createdAt: new Date('2026-08-26T10:00:00Z'),
  })
}
```

New tests inside `test.group('Product', …)`:

```ts
  const AT = new Date('2026-09-13T18:00:00Z')

  test('create() sets initialQuantity to the created quantity', ({ assert }) => {
    assert.equal(buildProduct(null, { amount: 6 }).initialQuantity, 6)
  })

  test('update() raises initialQuantity when a correction goes above it, never lowers it', ({ assert }) => {
    const product = buildProduct(null, { amount: 6 })
    const up = Quantity.create(8, 'L')
    const down = Quantity.create(2, 'L')
    if (!up.ok || !down.ok) throw new Error('unreachable')

    product.update({ quantity: up.value }, AT)
    assert.equal(product.initialQuantity, 8)

    product.update({ quantity: down.value }, AT)
    assert.equal(product.initialQuantity, 8)
  })

  test('takeOut() of part of the stock decrements the product and prorates the price', ({ assert }) => {
    const product = buildProduct(null, { amount: 6, price: 3 })
    const result = product.takeOut(2, AT)

    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.strictEqual(result.value.remaining, product)
    assert.equal(product.quantity.amount, 4)
    assert.equal(product.initialQuantity, 6)
    assert.equal(product.updatedAt.toISOString(), AT.toISOString())
    assert.equal(result.value.taken.amount, 2)
    assert.equal(result.value.taken.unit, 'L')
    assert.equal(result.value.price, 1)
  })

  test('takeOut() of the whole stock leaves nothing and does not touch the product', ({ assert }) => {
    const product = buildProduct(null, { amount: 6, price: 3 })
    product.takeOut(2, AT)
    const result = product.takeOut(4, AT)

    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.isNull(result.value.remaining)
    assert.equal(product.quantity.amount, 4)
    assert.equal(result.value.price, 2)
  })

  test('takeOut() rounds the prorated price to the cent', ({ assert }) => {
    const result = buildProduct(null, { amount: 3, price: 1 }).takeOut(1, AT)
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value.price, 0.33)
  })

  test('takeOut() keeps a missing price missing', ({ assert }) => {
    const result = buildProduct(null, { amount: 2 }).takeOut(1, AT)
    assert.isTrue(result.ok)
    if (result.ok) assert.isNull(result.value.price)
  })

  test('takeOut() refuses zero, fractions, and more than the stock', ({ assert }) => {
    const product = buildProduct(null, { amount: 2 })
    for (const amount of [0, 1.5, 3]) {
      const result = product.takeOut(amount, AT)
      assert.isFalse(result.ok)
      if (!result.ok) assert.equal(result.error.field, 'quantity')
    }
    assert.equal(product.quantity.amount, 2)
  })
```

- [ ] **Step 6: Run to see them fail**

Run: `cd backend && node ace test unit --files="tests/unit/domain/fridge/product.entity.spec.ts"`
Expected: FAIL — `initialQuantity`/`takeOut` do not exist.

- [ ] **Step 7: Implement in `product.entity.ts`**

Add `Quantity` as a value import (it is currently `import type`) and `Result`:

```ts
import { AggregateRoot } from '#domain/shared/aggregate-root'
import { Quantity } from './quantity.vo.js'
import type { Location } from './location.vo.js'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'
```

Add to `ProductProps` (after `quantity`):

```ts
  /** The largest quantity this product is known to have had — what `price` pays for (ADR-0012). */
  initialQuantity: number
```

In `create()`, after `quantity: params.quantity,`:

```ts
      initialQuantity: params.quantity.amount,
```

Add the result type above the class:

```ts
export interface TakeOut {
  /** The product still in the garde-manger, or `null` when the whole stock left. */
  remaining: Product | null
  /** The part that left — the quantity an outcome records. */
  taken: Quantity
  /** `price` prorated to `taken` over `initialQuantity`, to the cent. */
  price: number | null
}
```

Getter next to `quantity`:

```ts
  get initialQuantity(): number {
    return this.props.initialQuantity
  }
```

Replace `update()`:

```ts
  update(patch: UpdateProductProps, updatedAt: Date): void {
    const initialQuantity = Math.max(this.props.initialQuantity, patch.quantity?.amount ?? 0)
    this.props = { ...this.props, ...patch, initialQuantity, updatedAt }
  }
```

Add `takeOut()` after `update()`:

```ts
  /**
   * Some or all of the stock leaves the garde-manger.
   *
   * The whole stock returns `remaining: null` and leaves this instance as it
   * was — the repository deletes the row. Part of it decrements in place.
   * Either way the caller gets the part that left and what it was worth, which
   * is everything an outcome needs that the product will no longer say.
   */
  takeOut(amount: number, at: Date): ResultType<TakeOut, ValidationError> {
    const current = this.props.quantity
    if (!Number.isInteger(amount) || amount <= 0 || amount > current.amount) {
      return Result.err({
        field: 'quantity',
        message: `La quantité sortie doit être un entier entre 1 et ${current.amount}.`,
      })
    }

    const taken = Quantity.create(amount, current.unit)
    if (!taken.ok) return taken

    const price =
      this.props.price === null
        ? null
        : Math.round(((this.props.price * amount) / this.props.initialQuantity) * 100) / 100

    if (amount === current.amount) return Result.ok({ remaining: null, taken: taken.value, price })

    const left = Quantity.create(current.amount - amount, current.unit)
    if (!left.ok) return left
    this.props = { ...this.props, quantity: left.value, updatedAt: at }
    return Result.ok({ remaining: this, taken: taken.value, price })
  }
```

- [ ] **Step 8: Fix every `Product.reconstruct` caller**

Run: `cd backend && grep -rn "Product.reconstruct" src tests`
Expected: `src/infrastructure/database/fridge/product.mapper.ts` (fixed in Task 3). If any test builds `ProductProps` by hand, add `initialQuantity` there.

- [ ] **Step 9: Run the `Product` tests**

Run: same command as Step 6.
Expected: PASS (existing tests included).

- [ ] **Step 10: Write the failing `ProductOutcome` test**

`backend/tests/unit/domain/fridge/product-outcome.entity.spec.ts`:

```ts
import { test } from '@japa/runner'
import { Product } from '#domain/fridge/product.entity'
import { ProductOutcome } from '#domain/fridge/product-outcome.entity'
import { OutcomeKind } from '#domain/fridge/outcome-kind.vo'
import { DiscardReason } from '#domain/fridge/discard-reason.vo'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'

const AT = new Date('2026-09-13T18:00:00Z')

function buildYaourts() {
  const quantity = Quantity.create(6, 'unités')
  const location = Location.create('fridge')
  if (!quantity.ok || !location.ok) throw new Error('unreachable')
  return Product.create({
    id: 'p_1',
    householdId: 'h_1',
    name: 'Yaourts nature',
    quantity: quantity.value,
    location: location.value,
    category: 'Produits laitiers',
    categories: ['yogurts'],
    expiresAt: new Date('2026-09-10T00:00:00Z'),
    price: 3,
    createdAt: new Date('2026-09-01T10:00:00Z'),
  })
}

test.group('ProductOutcome', () => {
  test('fromProduct() snapshots the product and records the part taken, not the stock left', ({ assert }) => {
    const product = buildYaourts()
    const takeOut = product.takeOut(2, AT)
    const reason = DiscardReason.create('expired')
    if (!takeOut.ok || !reason.ok) throw new Error('unreachable')

    const outcome = ProductOutcome.fromProduct(product, {
      id: 'o_1',
      kind: OutcomeKind.discarded(),
      discardReason: reason.value,
      recordedBy: 'u_1',
      recipeId: null,
      takeOut: takeOut.value,
      at: AT,
    })

    assert.equal(outcome.id, 'o_1')
    assert.equal(outcome.householdId, 'h_1')
    assert.equal(outcome.productId, 'p_1')
    assert.equal(outcome.kind.value, 'discarded')
    assert.equal(outcome.discardReason?.value, 'expired')
    assert.equal(outcome.productName, 'Yaourts nature')
    assert.equal(outcome.category, 'Produits laitiers')
    assert.deepEqual(outcome.categories, ['yogurts'])
    assert.equal(outcome.location.value, 'fridge')
    assert.equal(outcome.quantity.amount, 2)
    assert.equal(outcome.price, 1)
    assert.equal(outcome.expiresAt?.toISOString(), '2026-09-10T00:00:00.000Z')
    assert.equal(outcome.occurredAt.toISOString(), AT.toISOString())
  })
})
```

- [ ] **Step 11: Implement `product-outcome.entity.ts`**

`Product` extends `AggregateRoot`, which extends `Entity` — use the same base (`#domain/shared/entity`; confirm the exact export with `ls backend/src/domain/shared`).

```ts
import { Entity } from '#domain/shared/entity'
import type { Product, TakeOut } from './product.entity.js'
import type { OutcomeKind } from './outcome-kind.vo.js'
import type { DiscardReason } from './discard-reason.vo.js'
import type { Quantity } from './quantity.vo.js'
import type { Location } from './location.vo.js'

export interface ProductOutcomeProps {
  householdId: string
  productId: string
  /** `null` only once the member has left the foyer — never written as null. */
  recordedBy: string | null
  recipeId: string | null
  kind: OutcomeKind
  discardReason: DiscardReason | null
  productName: string
  category: string
  categories: string[] | null
  location: Location
  quantity: Quantity
  price: number | null
  expiresAt: Date | null
  occurredAt: Date
}

export interface RecordOutcomeParams {
  id: string
  kind: OutcomeKind
  discardReason: DiscardReason | null
  recordedBy: string
  recipeId: string | null
  takeOut: TakeOut
  at: Date
}

/**
 * A product leaving the garde-manger, written down once and never edited.
 *
 * Carries its own copy of everything a statistic reads, because the product it
 * describes is usually deleted in the same transaction (ADR-0012).
 */
export class ProductOutcome extends Entity<string> {
  private readonly props: ProductOutcomeProps

  private constructor(id: string, props: ProductOutcomeProps) {
    super(id)
    this.props = props
  }

  /**
   * `product` is read for its identity and description only — never its
   * quantity, which `takeOut()` may already have decremented. The part that
   * left comes from `params.takeOut`.
   */
  static fromProduct(product: Product, params: RecordOutcomeParams): ProductOutcome {
    return new ProductOutcome(params.id, {
      householdId: product.householdId,
      productId: product.id,
      recordedBy: params.recordedBy,
      recipeId: params.recipeId,
      kind: params.kind,
      discardReason: params.discardReason,
      productName: product.name,
      category: product.category,
      categories: product.categories,
      location: product.location,
      quantity: params.takeOut.taken,
      price: params.takeOut.price,
      expiresAt: product.expiresAt,
      occurredAt: params.at,
    })
  }

  static reconstruct(id: string, props: ProductOutcomeProps): ProductOutcome {
    return new ProductOutcome(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }
  get productId(): string {
    return this.props.productId
  }
  get recordedBy(): string | null {
    return this.props.recordedBy
  }
  get recipeId(): string | null {
    return this.props.recipeId
  }
  get kind(): OutcomeKind {
    return this.props.kind
  }
  get discardReason(): DiscardReason | null {
    return this.props.discardReason
  }
  get productName(): string {
    return this.props.productName
  }
  get category(): string {
    return this.props.category
  }
  get categories(): string[] | null {
    return this.props.categories
  }
  get location(): Location {
    return this.props.location
  }
  get quantity(): Quantity {
    return this.props.quantity
  }
  get price(): number | null {
    return this.props.price
  }
  get expiresAt(): Date | null {
    return this.props.expiresAt
  }
  get occurredAt(): Date {
    return this.props.occurredAt
  }
}
```

- [ ] **Step 12: Run all fridge domain tests**

Run: `cd backend && node ace test unit --files="tests/unit/domain/fridge/*"`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add backend/src/domain/fridge backend/tests/unit/domain/fridge
git commit -m "feat(backend): model product outcomes and Product.takeOut with price prorata"
```

---

## Task 3: Persistence — mapper, `ProductOutcomeModel`, `recordOutcome()`

**Files:**
- Modify: `backend/src/infrastructure/database/fridge/product.lucid.ts`
- Modify: `backend/src/infrastructure/database/fridge/product.mapper.ts`
- Modify: `backend/src/infrastructure/database/fridge/product.repository.ts`
- Create: `backend/src/infrastructure/database/fridge/product_outcome.lucid.ts`
- Modify: `backend/src/domain/fridge/interfaces/product-repository.interface.ts`
- Modify: `backend/tests/infrastructure/fridge/product.repository.spec.ts`

**Interfaces:**
- Consumes: `ProductOutcome`, `Product.initialQuantity` (Task 2).
- Produces: `ProductRepository.recordOutcome(outcome: ProductOutcome, remaining: Product | null): Promise<void>`.

- [ ] **Step 1: Extend the repository interface**

```ts
import type { Product } from '../product.entity.js'
import type { ProductOutcome } from '../product-outcome.entity.js'
import type { LocationValue } from '../location.vo.js'

// ...ProductFilters unchanged...

export interface ProductRepository {
  findById(id: string): Promise<Product | null>
  findByHousehold(householdId: string, filters?: ProductFilters): Promise<Product[]>
  findExpiringSoon(householdId: string, withinDays: number): Promise<Product[]>
  findByReceiptId(receiptId: string): Promise<Product[]>
  save(product: Product): Promise<void>
  /** A data-entry correction: removes the product and records nothing (ADR-0012). */
  delete(id: string): Promise<void>
  /**
   * Writes the outcome and applies it to the stock in one transaction:
   * `remaining === null` deletes the product, otherwise `remaining` is saved.
   */
  recordOutcome(outcome: ProductOutcome, remaining: Product | null): Promise<void>
}
```

- [ ] **Step 2: Write the failing repository tests**

Add to `backend/tests/infrastructure/fridge/product.repository.spec.ts`. Extend imports and `buildProduct` overrides with `amount` and `price`:

```ts
import { ProductOutcome } from '#domain/fridge/product-outcome.entity'
import { OutcomeKind } from '#domain/fridge/outcome-kind.vo'
import type { Product as ProductEntity } from '#domain/fridge/product.entity'
```

```ts
function buildProduct(
  id: string,
  householdId: string,
  overrides: Partial<{ location: string; expiresAt: Date | null; amount: number; price: number | null }> = {},
) {
  const quantity = Quantity.create(overrides.amount ?? 1, 'L')
  // ...rest unchanged, plus:
  //   price: overrides.price ?? null,
}

function outcomeFor(product: ProductEntity, amount: number, id = 'o_1') {
  const at = new Date('2026-09-13T18:00:00Z')
  const takeOut = product.takeOut(amount, at)
  if (!takeOut.ok) throw new Error('unreachable')
  const outcome = ProductOutcome.fromProduct(product, {
    id,
    kind: OutcomeKind.consumed(),
    discardReason: null,
    recordedBy: 'u_1',
    recipeId: null,
    takeOut: takeOut.value,
    at,
  })
  return { outcome, remaining: takeOut.value.remaining }
}
```

Tests inside the group:

```ts
  test('save() round-trips initialQuantity', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')
    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_1', 'h_1', { amount: 6 }))

    const found = await repository.findById('p_1')
    assert.equal(found?.initialQuantity, 6)
  })

  test('recordOutcome() of the whole stock deletes the product and writes the log row', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')
    const repository = new LucidProductRepository()
    const product = buildProduct('p_1', 'h_1', { amount: 2, price: 3 })
    await repository.save(product)

    const { outcome, remaining } = outcomeFor(product, 2)
    await repository.recordOutcome(outcome, remaining)

    assert.isNull(await repository.findById('p_1'))
    const rows = await db.from('product_outcome').where('product_id', 'p_1')
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].kind, 'consumed')
    assert.equal(rows[0].amount, 2)
    assert.equal(Number(rows[0].price), 3)
    assert.equal(rows[0].product_name, 'Lait')
  })

  test('recordOutcome() of part of the stock decrements the product and writes the log row', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')
    const repository = new LucidProductRepository()
    const product = buildProduct('p_1', 'h_1', { amount: 6, price: 3 })
    await repository.save(product)

    const { outcome, remaining } = outcomeFor(product, 2)
    await repository.recordOutcome(outcome, remaining)

    const found = await repository.findById('p_1')
    assert.equal(found?.quantity.amount, 4)
    assert.equal(found?.initialQuantity, 6)
    const rows = await db.from('product_outcome').where('product_id', 'p_1')
    assert.equal(Number(rows[0].price), 1)
  })

  test('recordOutcome() leaves the stock untouched when the log row cannot be written', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')
    const repository = new LucidProductRepository()
    const product = buildProduct('p_1', 'h_1', { amount: 2 })
    await repository.save(product)

    // An unknown member id violates `recorded_by`'s foreign key — after the
    // product row has already been deleted inside the transaction.
    const at = new Date('2026-09-13T18:00:00Z')
    const takeOut = product.takeOut(2, at)
    if (!takeOut.ok) throw new Error('unreachable')
    const outcome = ProductOutcome.fromProduct(product, {
      id: 'o_1',
      kind: OutcomeKind.consumed(),
      discardReason: null,
      recordedBy: 'u_missing',
      recipeId: null,
      takeOut: takeOut.value,
      at,
    })

    await assert.rejects(() => repository.recordOutcome(outcome, takeOut.value.remaining))
    assert.isNotNull(await repository.findById('p_1'))
  })
```

- [ ] **Step 3: Run to see them fail**

Run: `cd backend && node ace test infrastructure --files="tests/infrastructure/fridge/product.repository.spec.ts"`
Expected: FAIL — `recordOutcome` missing, `initialQuantity` not persisted.

- [ ] **Step 4: Model, mapper, repository**

`product.lucid.ts` — after `quantity`:

```ts
  @column({ columnName: 'initial_quantity' })
  declare initialQuantity: number
```

`product.mapper.ts` — in `Product.reconstruct` props, after `quantity`:

```ts
    initialQuantity: row.initialQuantity,
```

Create `product_outcome.lucid.ts` (snake-case file name, same as `recipe_cook.lucid.ts`):

```ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { LocationValue } from '#domain/fridge/location.vo'
import type { OutcomeKindValue } from '#domain/fridge/outcome-kind.vo'
import type { DiscardReasonValue } from '#domain/fridge/discard-reason.vo'

export default class ProductOutcomeModel extends BaseModel {
  static table = 'product_outcome'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'product_id' })
  declare productId: string

  @column({ columnName: 'recorded_by' })
  declare recordedBy: string | null

  @column({ columnName: 'recipe_id' })
  declare recipeId: string | null

  @column()
  declare kind: OutcomeKindValue

  @column({ columnName: 'discard_reason' })
  declare discardReason: DiscardReasonValue | null

  @column({ columnName: 'product_name' })
  declare productName: string

  @column()
  declare category: string

  @column()
  declare categories: string[] | null

  @column()
  declare location: LocationValue

  @column()
  declare amount: number

  @column()
  declare unit: string

  @column()
  declare price: number | null

  @column.dateTime({ columnName: 'expires_at' })
  declare expiresAt: DateTime | null

  @column.dateTime({ columnName: 'occurred_at' })
  declare occurredAt: DateTime
}
```

`product.repository.ts` — import `db`, the new model and `ProductOutcome`; factor the row shape out of `save()` and add `recordOutcome()`:

```ts
import db from '@adonisjs/lucid/services/db'
import ProductOutcomeModel from './product_outcome.lucid.js'
import type { ProductOutcome } from '#domain/fridge/product-outcome.entity'

function toRow(product: Product) {
  return {
    householdId: product.householdId,
    receiptId: product.receiptId,
    name: product.name,
    quantity: product.quantity.amount,
    initialQuantity: product.initialQuantity,
    unit: product.quantity.unit,
    location: product.location.value,
    expiresAt: product.expiresAt ? DateTime.fromJSDate(product.expiresAt) : null,
    openedAt: product.openedAt ? DateTime.fromJSDate(product.openedAt) : null,
    category: product.category,
    openfoodfactId: product.openfoodfactId,
    categories: product.categories,
    price: product.price,
    imageKey: product.imageKey,
  }
}
```

```ts
  async save(product: Product): Promise<void> {
    await ProductModel.updateOrCreate({ id: product.id }, toRow(product))
  }

  /**
   * Stock first, log second, one transaction: if the log row cannot be
   * written, the product comes back — a sale that vanished from the fridge
   * without a trace is exactly what this table exists to prevent.
   */
  async recordOutcome(outcome: ProductOutcome, remaining: Product | null): Promise<void> {
    await db.transaction(async (trx) => {
      if (remaining === null) {
        await ProductModel.query({ client: trx }).where('id', outcome.productId).delete()
      } else {
        await ProductModel.updateOrCreate({ id: remaining.id }, toRow(remaining), { client: trx })
      }

      await ProductOutcomeModel.create(
        {
          id: outcome.id,
          householdId: outcome.householdId,
          productId: outcome.productId,
          recordedBy: outcome.recordedBy,
          recipeId: outcome.recipeId,
          kind: outcome.kind.value,
          discardReason: outcome.discardReason?.value ?? null,
          productName: outcome.productName,
          category: outcome.category,
          categories: outcome.categories,
          location: outcome.location.value,
          amount: outcome.quantity.amount,
          unit: outcome.quantity.unit,
          price: outcome.price,
          expiresAt: outcome.expiresAt ? DateTime.fromJSDate(outcome.expiresAt) : null,
          occurredAt: DateTime.fromJSDate(outcome.occurredAt),
        },
        { client: trx },
      )
    })
  }
```

No outcome mapper back to the domain yet — nothing reads outcomes in this plan. The stats spec adds it.

- [ ] **Step 5: Run the repository tests**

Run: same command as Step 3.
Expected: PASS, including every pre-existing repository test.

- [ ] **Step 6: Typecheck**

Run: `task typecheck`
Expected: PASS. If another `ProductRepository` implementation exists (a test fake), add `recordOutcome` to it.

- [ ] **Step 7: Commit**

```bash
git add backend/src/infrastructure/database/fridge backend/src/domain/fridge/interfaces backend/tests/infrastructure/fridge
git commit -m "feat(backend): persist product outcomes atomically with the stock change"
```

---

## Task 4: `RecordProductOutcome` use-case + `CookRecipe` switch

**Files:**
- Create: `backend/src/application/fridge/record-product-outcome.use-case.ts`
- Modify: `backend/src/application/recipe/cook-recipe.use-case.ts`
- Modify: `backend/src/application/fridge/delete-product.use-case.ts` (comment only)
- Create: `backend/tests/unit/application/fridge/fakes.ts`
- Create: `backend/tests/unit/application/fridge/record-product-outcome.use-case.spec.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces: `RecordProductOutcome.execute(input): Promise<Result<{ product: Product | null; outcome: ProductOutcome }, 'product_not_found' | ValidationError>>`.

- [ ] **Step 1: Fakes**

`backend/tests/unit/application/fridge/fakes.ts`:

```ts
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { Product } from '#domain/fridge/product.entity'
import type { ProductOutcome } from '#domain/fridge/product-outcome.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'
import { Product as ProductEntity } from '#domain/fridge/product.entity'

export class FakeProductRepository implements ProductRepository {
  readonly products = new Map<string, Product>()
  readonly outcomes: ProductOutcome[] = []

  async findById(id: string) {
    return this.products.get(id) ?? null
  }
  async findByHousehold(householdId: string) {
    return [...this.products.values()].filter((product) => product.householdId === householdId)
  }
  async findExpiringSoon() {
    return []
  }
  async findByReceiptId() {
    return []
  }
  async save(product: Product) {
    this.products.set(product.id, product)
  }
  async delete(id: string) {
    this.products.delete(id)
  }
  async recordOutcome(outcome: ProductOutcome, remaining: Product | null) {
    if (remaining === null) this.products.delete(outcome.productId)
    else this.products.set(remaining.id, remaining)
    this.outcomes.push(outcome)
  }
}

export function buildProduct(
  overrides: Partial<{ id: string; householdId: string; amount: number; price: number | null }> = {},
): Product {
  const quantity = Quantity.create(overrides.amount ?? 6, 'unités')
  const location = Location.create('fridge')
  if (!quantity.ok || !location.ok) throw new Error('unreachable')
  return ProductEntity.create({
    id: overrides.id ?? 'p_1',
    householdId: overrides.householdId ?? 'h_1',
    name: 'Yaourts nature',
    quantity: quantity.value,
    location: location.value,
    category: 'Produits laitiers',
    price: overrides.price ?? 3,
    createdAt: new Date('2026-09-01T10:00:00Z'),
  })
}

export const FIXED_CLOCK = { now: () => new Date('2026-09-13T18:00:00.000Z') }
export const SEQUENTIAL_IDS = (prefix: string) => {
  let n = 0
  return { next: () => `${prefix}-${++n}` }
}
```

- [ ] **Step 2: Write the failing use-case tests**

`backend/tests/unit/application/fridge/record-product-outcome.use-case.spec.ts`:

```ts
import { test } from '@japa/runner'
import { RecordProductOutcome } from '#application/fridge/record-product-outcome.use-case'
import { FakeProductRepository, buildProduct, FIXED_CLOCK, SEQUENTIAL_IDS } from './fakes.js'

async function setup(product = buildProduct()) {
  const products = new FakeProductRepository()
  await products.save(product)
  const useCase = new RecordProductOutcome(products, SEQUENTIAL_IDS('outcome'), FIXED_CLOCK)
  return { products, useCase }
}

const BASE = { householdId: 'h_1', userId: 'u_1', productId: 'p_1' }

test.group('RecordProductOutcome', () => {
  test('without an amount, the whole stock leaves and the product is gone', async ({ assert }) => {
    const { products, useCase } = await setup()
    const result = await useCase.execute({ ...BASE, kind: 'consumed' })

    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.isNull(result.value.product)
    assert.equal(result.value.outcome.quantity.amount, 6)
    assert.equal(result.value.outcome.recordedBy, 'u_1')
    assert.isNull(await products.findById('p_1'))
    assert.lengthOf(products.outcomes, 1)
  })

  test('a partial discard keeps the rest in the garde-manger, with its reason', async ({ assert }) => {
    const { products, useCase } = await setup()
    const result = await useCase.execute({ ...BASE, kind: 'discarded', amount: 2, discardReason: 'spoiled' })

    assert.isTrue(result.ok)
    if (!result.ok) return
    assert.equal(result.value.product?.quantity.amount, 4)
    assert.equal(result.value.outcome.discardReason?.value, 'spoiled')
    assert.equal(result.value.outcome.price, 1)
    assert.equal(result.value.outcome.occurredAt.toISOString(), FIXED_CLOCK.now().toISOString())
    assert.equal((await products.findById('p_1'))?.quantity.amount, 4)
  })

  test('another household product is not found', async ({ assert }) => {
    const { products, useCase } = await setup(buildProduct({ householdId: 'h_other' }))
    const result = await useCase.execute({ ...BASE, kind: 'consumed' })

    assert.deepEqual(result, { ok: false, error: 'product_not_found' })
    assert.lengthOf(products.outcomes, 0)
  })

  test('a reason on a consumed product is refused and nothing is written', async ({ assert }) => {
    const { products, useCase } = await setup()
    const result = await useCase.execute({ ...BASE, kind: 'consumed', discardReason: 'expired' })

    assert.isFalse(result.ok)
    if (!result.ok) assert.deepInclude(result.error, { field: 'discardReason' })
    assert.equal((await products.findById('p_1'))?.quantity.amount, 6)
    assert.lengthOf(products.outcomes, 0)
  })

  test('more than the stock is refused and nothing is written', async ({ assert }) => {
    const { products, useCase } = await setup()
    const result = await useCase.execute({ ...BASE, kind: 'discarded', amount: 7 })

    assert.isFalse(result.ok)
    assert.equal((await products.findById('p_1'))?.quantity.amount, 6)
    assert.lengthOf(products.outcomes, 0)
  })
})
```

- [ ] **Step 3: Run to see them fail**

Run: `cd backend && node ace test unit --files="tests/unit/application/fridge/*"`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the use-case**

`backend/src/application/fridge/record-product-outcome.use-case.ts`:

```ts
import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import type { Product } from '#domain/fridge/product.entity'
import { ProductOutcome } from '#domain/fridge/product-outcome.entity'
import { OutcomeKind } from '#domain/fridge/outcome-kind.vo'
import { DiscardReason } from '#domain/fridge/discard-reason.vo'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface RecordProductOutcomeInput {
  householdId: string
  userId: string
  productId: string
  kind: string
  /** Defaults to the whole remaining stock. */
  amount?: number
  discardReason?: string | null
}

export type RecordProductOutcomeError = 'product_not_found' | ValidationError

export interface RecordedProductOutcome {
  /** `null` when the whole stock left the garde-manger. */
  product: Product | null
  outcome: ProductOutcome
}

/**
 * A product, or part of it, leaves the garde-manger — eaten or thrown away.
 *
 * Every check runs before `takeOut()`, the only step that mutates the product,
 * so a refused request leaves it exactly as it was.
 */
export class RecordProductOutcome implements UseCase<
  RecordProductOutcomeInput,
  ResultType<RecordedProductOutcome, RecordProductOutcomeError>
> {
  constructor(
    private readonly products: ProductRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: RecordProductOutcomeInput,
  ): Promise<ResultType<RecordedProductOutcome, RecordProductOutcomeError>> {
    const product = await this.products.findById(input.productId)
    if (!product || product.householdId !== input.householdId) return Result.err('product_not_found')

    const kind = OutcomeKind.create(input.kind)
    if (!kind.ok) return kind

    let discardReason: DiscardReason | null = null
    if (input.discardReason !== undefined && input.discardReason !== null) {
      if (kind.value.value !== 'discarded') {
        return Result.err({
          field: 'discardReason',
          message: 'Une raison ne s’applique qu’à un produit jeté.',
        })
      }
      const reason = DiscardReason.create(input.discardReason)
      if (!reason.ok) return reason
      discardReason = reason.value
    }

    const at = this.clock.now()
    const takeOut = product.takeOut(input.amount ?? product.quantity.amount, at)
    if (!takeOut.ok) return takeOut

    const outcome = ProductOutcome.fromProduct(product, {
      id: this.idGenerator.next(),
      kind: kind.value,
      discardReason,
      recordedBy: input.userId,
      recipeId: null,
      takeOut: takeOut.value,
      at,
    })

    await this.products.recordOutcome(outcome, takeOut.value.remaining)
    return Result.ok({ product: takeOut.value.remaining, outcome })
  }
}
```

- [ ] **Step 5: Run the use-case tests**

Run: same command as Step 3.
Expected: PASS.

- [ ] **Step 6: Switch `CookRecipe` to outcomes**

In `backend/src/application/recipe/cook-recipe.use-case.ts`, add imports:

```ts
import { ProductOutcome } from '#domain/fridge/product-outcome.entity'
import { OutcomeKind } from '#domain/fridge/outcome-kind.vo'
```

Replace the loop:

```ts
    let consumed = 0
    for (const productId of new Set(input.productIds)) {
      const product = await this.products.findById(productId)
      if (!product || product.householdId !== input.householdId) continue

      // The meal used the product up: the whole stock leaves, written down as
      // eaten and linked to the dish that saved it — the one number the waste
      // statistics will want to put next to what was thrown away.
      const at = this.clock.now()
      const takeOut = product.takeOut(product.quantity.amount, at)
      if (!takeOut.ok) continue
      await this.products.recordOutcome(
        ProductOutcome.fromProduct(product, {
          id: this.idGenerator.next(),
          kind: OutcomeKind.consumed(),
          discardReason: null,
          recordedBy: input.userId,
          recipeId: recipe.id,
          takeOut: takeOut.value,
          at,
        }),
        takeOut.value.remaining,
      )
      consumed += 1
    }
```

Update the class docblock's sentence "takes the products the meal consumed out of the garde-manger" to add: "— recorded as consumed outcomes (ADR-0012), not bare deletions".

- [ ] **Step 7: Mark `DeleteProduct` as the correction path**

Add above the class in `delete-product.use-case.ts`:

```ts
/**
 * A data-entry correction — a duplicate scan, a receipt line that was not
 * food. Deliberately records no outcome: counting mistakes as waste would make
 * every statistic wrong. A product that was eaten or thrown away goes through
 * `RecordProductOutcome` instead (ADR-0012).
 */
```

- [ ] **Step 8: Typecheck and run backend unit tests**

Run: `task typecheck && cd backend && node ace test unit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/application backend/tests/unit/application/fridge
git commit -m "feat(backend): record product outcomes, and log cooked products as consumed"
```

---

## Task 5: HTTP — `POST /api/products/:id/outcomes`

**Files:**
- Modify: `backend/src/presentation/fridge/product.validator.ts`
- Create: `backend/src/presentation/fridge/product-outcome.dto.ts`
- Modify: `backend/src/presentation/fridge/product.controller.ts`
- Modify: `backend/src/presentation/fridge/product.routes.ts`
- Modify: `backend/tests/functional/fridge/product.spec.ts`
- Modify: `backend/tests/functional/recipe/recipe.spec.ts`
- Modify: `docs/phase-0/04-endpoints-http.md`

- [ ] **Step 1: Write the failing functional tests**

Append to the group in `backend/tests/functional/fridge/product.spec.ts` (add `import db from '@adonisjs/lucid/services/db'` at the top):

```ts
  async function createYaourts(client: import('@japa/api-client').ApiClient, cookie: string) {
    const create = await client
      .post('/api/products')
      .headers({ cookie })
      .json({
        name: 'Yaourts nature',
        quantity: { amount: 6, unit: 'unités' },
        location: 'fridge',
        category: 'Produits laitiers',
        price: 3,
      })
    create.assertStatus(201)
    return create.body().product.id as string
  }

  test('outcomes: one eaten, then the rest thrown away', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'outcome-flow@example.com')
    const productId = await createYaourts(client, cookie)

    const one = await client
      .post(`/api/products/${productId}/outcomes`)
      .headers({ cookie })
      .json({ kind: 'consumed', amount: 1 })
    one.assertStatus(200)
    one.assertBodyContains({
      product: { id: productId, quantity: { amount: 5 } },
      outcome: { kind: 'consumed', quantity: { amount: 1 }, price: 0.5, discardReason: null },
    })

    const rest = await client
      .post(`/api/products/${productId}/outcomes`)
      .headers({ cookie })
      .json({ kind: 'discarded', discardReason: 'spoiled' })
    rest.assertStatus(200)
    assert.isNull(rest.body().product)
    rest.assertBodyContains({ outcome: { kind: 'discarded', quantity: { amount: 5 }, discardReason: 'spoiled' } })

    const gone = await client.get(`/api/products/${productId}`).headers({ cookie })
    gone.assertStatus(404)

    const rows = await db.from('product_outcome').where('product_id', productId).orderBy('amount')
    assert.deepEqual(
      rows.map((row) => [row.kind, row.amount]),
      [
        ['consumed', 1],
        ['discarded', 5],
      ],
    )
  })

  test('outcomes: another household product is a 404 and stays put', async ({ client }) => {
    const cookieA = await signUpWithHousehold(client, 'outcome-owner@example.com')
    const cookieB = await signUpWithHousehold(client, 'outcome-intruder@example.com')
    const productId = await createYaourts(client, cookieA)

    const response = await client
      .post(`/api/products/${productId}/outcomes`)
      .headers({ cookie: cookieB })
      .json({ kind: 'discarded' })
    response.assertStatus(404)

    const still = await client.get(`/api/products/${productId}`).headers({ cookie: cookieA })
    still.assertBodyContains({ product: { quantity: { amount: 6 } } })
  })

  test('outcomes: invalid requests are 400 and change nothing', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'outcome-invalid@example.com')
    const productId = await createYaourts(client, cookie)

    for (const body of [
      { kind: 'consumed', amount: 7 },
      { kind: 'consumed', discardReason: 'expired' },
      { kind: 'deleted' },
      { kind: 'discarded', discardReason: 'moldy' },
      { kind: 'consumed', amount: 1.5 },
    ]) {
      const response = await client.post(`/api/products/${productId}/outcomes`).headers({ cookie }).json(body)
      response.assertStatus(400)
    }

    const still = await client.get(`/api/products/${productId}`).headers({ cookie })
    still.assertBodyContains({ product: { quantity: { amount: 6 } } })
  })

  test('DELETE is a correction and writes no outcome', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'outcome-delete@example.com')
    const productId = await createYaourts(client, cookie)

    const destroy = await client.delete(`/api/products/${productId}`).headers({ cookie })
    destroy.assertStatus(204)

    const rows = await db.from('product_outcome').where('product_id', productId)
    assert.lengthOf(rows, 0)
  })
```

In `backend/tests/functional/recipe/recipe.spec.ts`, import `db` and extend `cooking a recipe consumes its products and is counted` right after `gone.assertStatus(404)`:

```ts
    const outcomes = await db.from('product_outcome').where('product_id', productId)
    assert.lengthOf(outcomes, 1)
    assert.equal(outcomes[0].kind, 'consumed')
    assert.equal(outcomes[0].recipe_id, recipeId)
    assert.equal(outcomes[0].amount, 200)
```

- [ ] **Step 2: Run to see them fail**

Run: `cd backend && node ace test functional --files="tests/functional/fridge/product.spec.ts"`
Expected: the new `outcomes:` tests FAIL with 404 (route missing); the DELETE test passes already.

- [ ] **Step 3: Validator**

Append to `product.validator.ts`:

```ts
export const recordProductOutcomeValidator = vine.compile(
  vine.object({
    kind: vine.enum(['consumed', 'discarded'] as const),
    amount: vine.number().withoutDecimals().positive().optional(),
    discardReason: vine.enum(['expired', 'spoiled', 'disliked', 'other'] as const).optional().nullable(),
  }),
)
```

- [ ] **Step 4: DTO**

`backend/src/presentation/fridge/product-outcome.dto.ts`:

```ts
import type { ProductOutcome } from '#domain/fridge/product-outcome.entity'

export interface ProductOutcomeDto {
  id: string
  productId: string
  recordedBy: string | null
  recipeId: string | null
  kind: string
  discardReason: string | null
  productName: string
  category: string
  categories: string[] | null
  location: string
  quantity: { amount: number; unit: string }
  price: number | null
  expiresAt: string | null
  occurredAt: string
}

export function toProductOutcomeDto(outcome: ProductOutcome): ProductOutcomeDto {
  return {
    id: outcome.id,
    productId: outcome.productId,
    recordedBy: outcome.recordedBy,
    recipeId: outcome.recipeId,
    kind: outcome.kind.value,
    discardReason: outcome.discardReason?.value ?? null,
    productName: outcome.productName,
    category: outcome.category,
    categories: outcome.categories,
    location: outcome.location.value,
    quantity: { amount: outcome.quantity.amount, unit: outcome.quantity.unit },
    price: outcome.price,
    expiresAt: outcome.expiresAt?.toISOString() ?? null,
    occurredAt: outcome.occurredAt.toISOString(),
  }
}
```

- [ ] **Step 5: Controller action**

In `product.controller.ts`, import `recordProductOutcomeValidator`, `toProductOutcomeDto` and `RecordProductOutcome`, then add after `destroy`:

```ts
  async recordOutcome(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(
      ctx,
      'fridge',
      RecordProductOutcome,
      async () => {
        const payload = await ctx.request.validateUsing(recordProductOutcomeValidator)
        const products = await ctx.containerResolver.make('fridge.products')
        const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
        const clock = await ctx.containerResolver.make('shared.clock')

        const result = await new RecordProductOutcome(products, idGenerator, clock).execute({
          householdId: ctx.household.id,
          userId: user.id,
          productId: ctx.params.id,
          ...payload,
        })
        if (!result.ok) {
          const { status, body } = serializeError(result.error)
          ctx.response.status(status).json(body)
          return result
        }
        ctx.response.json({
          product: result.value.product ? toProductDto(result.value.product) : null,
          outcome: toProductOutcomeDto(result.value.outcome),
        })
        return result
      },
      { action: 'fridge.record_product_outcome', isError: (r) => !r.ok },
    )
  }
```

If `traceAction`'s options type does not accept `action` and `isError` together, read `backend/src/presentation/shared/trace-action.ts` and follow its signature — do not widen it.

- [ ] **Step 6: Route**

In `product.routes.ts`, after the `delete` line:

```ts
    router.post('/products/:id/outcomes', [ProductController, 'recordOutcome'])
```

- [ ] **Step 7: Run the functional tests**

Run: `cd backend && node ace test functional --files="tests/functional/fridge/product.spec.ts" --files="tests/functional/recipe/recipe.spec.ts"`
Expected: PASS.

- [ ] **Step 8: Endpoint doc**

In `docs/phase-0/04-endpoints-http.md`, after the `GET/PATCH/DELETE /api/products/:id` section:

````md
### `POST /api/products/:id/outcomes`

Sortie d'un produit du garde-manger, totale ou partielle (ADR-0012).

```json
{ "kind": "discarded", "amount": 2, "discardReason": "spoiled" }
```

`kind` : `consumed` | `discarded`. `amount` : entier ≥ 1, défaut = toute la quantité
restante. `discardReason` : `expired` | `spoiled` | `disliked` | `other`, optionnel,
refusé avec `consumed`.

`200 { "product": ProductDto | null, "outcome": ProductOutcomeDto }` — `product` vaut
`null` quand toute la quantité est sortie. `404 product_not_found`,
`400 validation_failed`.

`DELETE /api/products/:id` reste la correction d'une erreur de saisie et n'écrit aucune
sortie.
````

- [ ] **Step 9: Bruno collection, if any**

Run: `cd /Users/floriaaan/dev/fridge-ai && find . -name "*.bru" -not -path "*/node_modules/*" | grep -i product`
If product requests exist, add `Record product outcome.bru` next to them, copying the shape of the delete request. Otherwise skip.

- [ ] **Step 10: Full backend check**

Run: `task lint && task typecheck && task test && task boundaries`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add backend/src/presentation/fridge backend/tests/functional docs/phase-0/04-endpoints-http.md
git commit -m "feat(backend): expose POST /api/products/:id/outcomes"
```

---

## Task 6: Mobile plumbing — types, connector, mutation

**Files:**
- Create: `mobile/src/domain/fridge/product-outcome.ts`
- Modify: `mobile/src/domain/interfaces/fridge-connector.ts`
- Modify: `mobile/src/infrastructure/http/http-fridge-connector.ts`
- Modify: `mobile/src/infrastructure/http/http-fridge-connector.test.ts`
- Modify: `mobile/src/infrastructure/fake/fake-fridge-connector.ts`
- Modify: `mobile/src/infrastructure/fake/fake-fridge-connector.test.ts`
- Create: `mobile/src/application/fridge/record-product-outcome.mutation.ts`

**Interfaces:**
- Produces: `FridgeConnector.recordProductOutcome(productId: string, input: RecordProductOutcomeInput): Promise<Result<RecordedProductOutcome, ApiError>>`, `useRecordProductOutcomeMutation()` taking `{ productId, input }`, `FakeFridgeConnector.outcomes: ProductOutcome[]`.

- [ ] **Step 1: Domain types**

`mobile/src/domain/fridge/product-outcome.ts`:

```ts
import type { LocationValue } from './location.js'
import type { Product } from './product.js'

export type OutcomeKind = 'consumed' | 'discarded'

export type DiscardReason = 'expired' | 'spoiled' | 'disliked' | 'other'

export const DISCARD_REASONS: readonly DiscardReason[] = ['expired', 'spoiled', 'disliked', 'other']

/** Mirrors `recordProductOutcomeValidator` (`product.validator.ts`). `amount` omitted = the whole stock. */
export interface RecordProductOutcomeInput {
  kind: OutcomeKind
  amount?: number
  discardReason?: DiscardReason | null
}

/** Structurally identical to the backend's `ProductOutcomeDto` (`product-outcome.dto.ts`). */
export interface ProductOutcome {
  id: string
  productId: string
  recordedBy: string | null
  recipeId: string | null
  kind: OutcomeKind
  discardReason: DiscardReason | null
  productName: string
  category: string
  categories: string[] | null
  location: LocationValue
  quantity: { amount: number; unit: string }
  price: number | null
  expiresAt: string | null
  occurredAt: string
}

export interface RecordedProductOutcome {
  /** `null` when the whole stock left the garde-manger. */
  product: Product | null
  outcome: ProductOutcome
}
```

- [ ] **Step 2: Connector interface**

In `fridge-connector.ts`, import the types and add after `deleteProduct`:

```ts
import type { RecordProductOutcomeInput, RecordedProductOutcome } from '../fridge/product-outcome.js'
```

```ts
  /** Eaten or thrown away — logged for the foyer's statistics. `deleteProduct` is for data-entry mistakes only. */
  recordProductOutcome(productId: string, input: RecordProductOutcomeInput): Promise<Result<RecordedProductOutcome, ApiError>>
```

- [ ] **Step 3: Failing connector tests**

Append to `http-fridge-connector.test.ts`:

```ts
test('recordProductOutcome() posts to the outcomes route and unwraps product and outcome', async () => {
  const outcome = {
    id: 'o-1', productId: 'p-1', recordedBy: 'u-1', recipeId: null, kind: 'discarded', discardReason: 'spoiled',
    productName: 'Yaourts', category: 'Laitier', categories: null, location: 'fridge',
    quantity: { amount: 2, unit: 'unités' }, price: 1, expiresAt: null, occurredAt: '2026-09-13T18:00:00.000Z',
  }
  const fetchMock = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve({ product: null, outcome }),
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const connector = new HttpFridgeConnector()
  const result = await connector.recordProductOutcome('p-1', { kind: 'discarded', amount: 2, discardReason: 'spoiled' })

  expect(result).toEqual({ ok: true, value: { product: null, outcome } })
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toContain('/api/products/p-1/outcomes')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual({ kind: 'discarded', amount: 2, discardReason: 'spoiled' })

  globalThis.fetch = originalFetch
})
```

Append to `fake-fridge-connector.test.ts`:

```ts
test('recordProductOutcome() of one unit decrements the product and logs the outcome', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.recordProductOutcome('fake-product-4', { kind: 'consumed', amount: 1 })

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.product?.quantity.amount).toBe(3)
  expect((await connector.getProduct('fake-product-4'))?.quantity.amount).toBe(3)
  expect(connector.outcomes).toHaveLength(1)
  expect(connector.outcomes[0]).toMatchObject({ kind: 'consumed', quantity: { amount: 1 } })
})

test('recordProductOutcome() without an amount removes the product', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.recordProductOutcome('fake-product-6', { kind: 'discarded', discardReason: 'expired' })

  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.product).toBeNull()
  expect(await connector.getProduct('fake-product-6')).toBeNull()
  expect(connector.outcomes[0]).toMatchObject({ discardReason: 'expired', quantity: { amount: 4 } })
})

test('recordProductOutcome() refuses an unknown product and more than the stock', async () => {
  const connector = new FakeFridgeConnector()
  expect((await connector.recordProductOutcome('nope', { kind: 'consumed' })).ok).toBe(false)
  expect((await connector.recordProductOutcome('fake-product-4', { kind: 'consumed', amount: 5 })).ok).toBe(false)
  expect(connector.outcomes).toHaveLength(0)
})
```

- [ ] **Step 4: Run to see them fail**

Run: `cd mobile && pnpm run test -- src/infrastructure/http/http-fridge-connector.test.ts src/infrastructure/fake/fake-fridge-connector.test.ts`
Expected: FAIL — method missing.

- [ ] **Step 5: Implement the HTTP connector**

After `deleteProduct` in `http-fridge-connector.ts`:

```ts
  async recordProductOutcome(
    productId: string,
    input: RecordProductOutcomeInput,
  ): Promise<Result<RecordedProductOutcome, ApiError>> {
    const result = await apiFetch<RecordedProductOutcome>(
      `/api/products/${productId}/outcomes`,
      { method: 'POST', body: JSON.stringify(input) },
      { action: 'fridge.record_product_outcome', attributes: { 'entity.id': productId } },
    )
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }
```

- [ ] **Step 6: Implement the fake**

In `fake-fridge-connector.ts`, next to the other private state:

```ts
  /** Every outcome recorded, oldest first — read by tests, never by screens. */
  readonly outcomes: ProductOutcome[] = []
  private nextOutcomeId = 1
```

After `deleteProduct`:

```ts
  async recordProductOutcome(
    productId: string,
    input: RecordProductOutcomeInput,
  ): Promise<Result<RecordedProductOutcome, ApiError>> {
    const index = this.products.findIndex((p) => p.id === productId)
    if (index === -1) return Result.err({ type: 'product_not_found', message: 'Produit introuvable.' })
    const product = this.products[index]
    const amount = input.amount ?? product.quantity.amount
    if (!Number.isInteger(amount) || amount < 1 || amount > product.quantity.amount) {
      return Result.err({ type: 'validation_failed', message: `La quantité sortie doit être un entier entre 1 et ${product.quantity.amount}.` })
    }

    const outcome: ProductOutcome = {
      id: `fake-outcome-${this.nextOutcomeId++}`,
      productId,
      recordedBy: this.session?.user.id ?? fakeSession.user.id,
      recipeId: null,
      kind: input.kind,
      discardReason: input.discardReason ?? null,
      productName: product.name,
      category: product.category,
      categories: product.categories,
      location: product.location,
      quantity: { amount, unit: product.quantity.unit },
      // The fake has no initial quantity to prorate against; the current stock is close enough for a demo.
      price: product.price === null ? null : Math.round((product.price * amount * 100) / product.quantity.amount) / 100,
      expiresAt: product.expiresAt,
      occurredAt: new Date().toISOString(),
    }
    this.outcomes.push(outcome)

    if (amount === product.quantity.amount) {
      this.products.splice(index, 1)
      return Result.ok({ product: null, outcome })
    }
    const remaining: Product = {
      ...product,
      quantity: { ...product.quantity, amount: product.quantity.amount - amount },
      updatedAt: new Date().toISOString(),
    }
    this.products.splice(index, 1, remaining)
    return Result.ok({ product: remaining, outcome })
  }
```

- [ ] **Step 7: Mutation**

`mobile/src/application/fridge/record-product-outcome.mutation.ts`:

```ts
import { defineMutation } from '../shared/define-mutation.js'
import type { RecordProductOutcomeInput } from '../../domain/fridge/product-outcome.js'

export const useRecordProductOutcomeMutation = defineMutation(
  (connector, variables: { productId: string; input: RecordProductOutcomeInput }) =>
    connector.recordProductOutcome(variables.productId, variables.input),
)
```

- [ ] **Step 8: Run tests and typecheck**

Run: `cd mobile && pnpm run test -- src/infrastructure && cd .. && task typecheck:mobile`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/domain mobile/src/infrastructure mobile/src/application/fridge/record-product-outcome.mutation.ts
git commit -m "feat(mobile): recordProductOutcome on both connectors"
```

---

## Task 7: `ActionSheet` body slot + `ProductExitSheet`

**Files:**
- Modify: `mobile/src/presentation/shared/action-sheet.tsx`
- Create: `mobile/src/presentation/fridge/product-exit-sheet.tsx`
- Create: `mobile/src/presentation/fridge/product-exit-sheet.test.tsx`

**Interfaces:**
- Produces: `ActionSheet` gains `children?: ReactNode`, rendered between the title block and the options. `ProductExitSheet` props:

```ts
{
  visible: boolean
  products: readonly Product[]
  onClose: () => void
  onConsumed: () => void
  /** `amount` is set only when a single product with more than one unit is being discarded. */
  onDiscarded: (details: { discardReason: DiscardReason | null; amount: number | null }) => void
  onCorrection: () => void
}
```

The sheet never calls the connector: the two screens own the requests, because they already own failure messaging and navigation.

- [ ] **Step 1: `ActionSheet` body slot**

Add `children` to the props object and type (`children?: React.ReactNode` with doc comment "Rendered between the title and the options — for a choice the options alone cannot carry."), and render `{children}` right after the `title` block, before `options.map`.

- [ ] **Step 2: Write the failing sheet tests**

`mobile/src/presentation/fridge/product-exit-sheet.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ProductExitSheet } from './product-exit-sheet.js'
import { fakeProducts } from '../../infrastructure/fake/fixtures/product.fixture.js'

const lait = fakeProducts.find((p) => p.id === 'fake-product-1')!
const jambon = fakeProducts.find((p) => p.id === 'fake-product-6')! // 4 tranches, date passed

function renderSheet(products = [lait]) {
  const handlers = { onClose: jest.fn(), onConsumed: jest.fn(), onDiscarded: jest.fn(), onCorrection: jest.fn() }
  render(
    <ThemeProvider>
      <ProductExitSheet visible products={products} {...handlers} />
    </ThemeProvider>,
  )
  return handlers
}

test('names the product and offers eaten, thrown away, and a quiet correction', () => {
  renderSheet()
  expect(screen.getByText('Retirer « Lait demi-écrémé » ?')).toBeTruthy()
  expect(screen.getByTestId('product-exit-consumed')).toBeTruthy()
  expect(screen.getByTestId('product-exit-discarded')).toBeTruthy()
  expect(screen.getByTestId('product-exit-correction')).toBeTruthy()
})

test('eaten and correction answer at once', () => {
  const handlers = renderSheet()
  fireEvent.press(screen.getByTestId('product-exit-consumed'))
  expect(handlers.onConsumed).toHaveBeenCalledTimes(1)
  fireEvent.press(screen.getByTestId('product-exit-correction'))
  expect(handlers.onCorrection).toHaveBeenCalledTimes(1)
})

test('thrown away asks why, and nothing is required', () => {
  const handlers = renderSheet()
  fireEvent.press(screen.getByTestId('product-exit-discarded'))

  expect(screen.getByText('Jeter « Lait demi-écrémé » ?')).toBeTruthy()
  // One unit: no amount to choose.
  expect(screen.queryByTestId('product-exit-amount-value')).toBeNull()

  fireEvent.press(screen.getByTestId('product-exit-discard-confirm'))
  expect(handlers.onDiscarded).toHaveBeenCalledWith({ discardReason: null, amount: null })
})

test('a product past its date comes with "Dépassé" already picked, and the amount defaults to all of it', () => {
  const handlers = renderSheet([jambon])
  fireEvent.press(screen.getByTestId('product-exit-discarded'))

  expect(screen.getByTestId('product-exit-reason-expired').props.accessibilityState).toMatchObject({ selected: true })
  expect(screen.getByTestId('product-exit-amount-value')).toHaveTextContent('4 tranches')

  fireEvent.press(screen.getByTestId('product-exit-amount-decrease'))
  fireEvent.press(screen.getByTestId('product-exit-reason-spoiled'))
  fireEvent.press(screen.getByTestId('product-exit-discard-confirm'))

  expect(handlers.onDiscarded).toHaveBeenCalledWith({ discardReason: 'spoiled', amount: 3 })
})

test('the amount never goes below one or above the stock', () => {
  renderSheet([jambon])
  fireEvent.press(screen.getByTestId('product-exit-discarded'))

  fireEvent.press(screen.getByTestId('product-exit-amount-increase'))
  expect(screen.getByTestId('product-exit-amount-value')).toHaveTextContent('4 tranches')
  for (let i = 0; i < 5; i++) fireEvent.press(screen.getByTestId('product-exit-amount-decrease'))
  expect(screen.getByTestId('product-exit-amount-value')).toHaveTextContent('1 tranches')
})

test('several products: plural wording, and no amount to pick', () => {
  const handlers = renderSheet([lait, jambon])
  expect(screen.getByText('Retirer 2 produits ?')).toBeTruthy()

  fireEvent.press(screen.getByTestId('product-exit-discarded'))
  expect(screen.getByText('Jeter 2 produits ?')).toBeTruthy()
  expect(screen.queryByTestId('product-exit-amount-value')).toBeNull()
  // Only one of the two is past its date: nothing is guessed.
  expect(screen.getByTestId('product-exit-reason-expired').props.accessibilityState).toMatchObject({ selected: false })

  fireEvent.press(screen.getByTestId('product-exit-discard-confirm'))
  expect(handlers.onDiscarded).toHaveBeenCalledWith({ discardReason: null, amount: null })
})
```

If `Chip`'s `testID` lands on a wrapper that does not carry `accessibilityState`, assert with `screen.getByRole('button', { name: 'Dépassé', selected: true })` instead.

- [ ] **Step 3: Run to see them fail**

Run: `cd mobile && pnpm run test -- src/presentation/fridge/product-exit-sheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `product-exit-sheet.tsx`**

```tsx
/**
 * How a product leaves the garde-manger — the question the app never asked.
 *
 * Every exit used to be a deletion, so the foyer's fridge knew what it held and
 * nothing about what it lost. Three answers now, in the order they happen in a
 * kitchen: eaten, thrown away, or never there (a duplicate scan). Only the
 * first two count in the foyer's statistics, and the third is drawn quietly so
 * it stays a correction rather than becoming the habit (ADR-0012).
 *
 * "Jeté" opens a second step instead of three more rows, because a reason and
 * an amount are details of that one answer. Neither is required: a sheet that
 * blocks on "why" gets a random answer, which is worse than none.
 */
import { useEffect, useState } from 'react'
import { Pressable } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { Chip } from '../shared/chip.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { BanIcon, CircleCheckIcon, PencilIcon } from '../dashboard/dashboard-icons.js'
import { productStatus } from '../dashboard/product-status.js'
import { DISCARD_REASONS } from '../../domain/fridge/product-outcome.js'
import type { DiscardReason } from '../../domain/fridge/product-outcome.js'
import type { Product } from '../../domain/fridge/product.js'

const REASON_LABELS: Record<DiscardReason, string> = {
  expired: 'Dépassé',
  spoiled: 'Abîmé',
  disliked: 'Pas aimé',
  other: 'Autre',
}

export function ProductExitSheet({
  visible,
  products,
  onClose,
  onConsumed,
  onDiscarded,
  onCorrection,
}: {
  visible: boolean
  products: readonly Product[]
  onClose: () => void
  onConsumed: () => void
  onDiscarded: (details: { discardReason: DiscardReason | null; amount: number | null }) => void
  onCorrection: () => void
}) {
  const palette = useSoftPalette()
  const single = products.length === 1 ? products[0] : null
  const allExpired = products.length > 0 && products.every((product) => productStatus(product) === 'expired')
  const stock = single && single.quantity.amount > 1 ? single.quantity.amount : null

  const [step, setStep] = useState<'choose' | 'discard'>('choose')
  const [reason, setReason] = useState<DiscardReason | null>(null)
  const [amount, setAmount] = useState<number | null>(null)

  // Every opening starts over: yesterday's "Abîmé" must not pre-answer today's milk.
  useEffect(() => {
    if (!visible) return
    setStep('choose')
    setReason(allExpired ? 'expired' : null)
    setAmount(stock)
  }, [visible, allExpired, stock])

  const subject = single ? `« ${single.name} »` : `${products.length} produits`
  const plural = products.length > 1

  if (step === 'choose') {
    return (
      <ActionSheet
        visible={visible}
        onClose={onClose}
        title={`Retirer ${subject} ?`}
        description="Mangé ou jeté, ça compte dans le bilan du foyer. Une erreur de saisie ne compte pas."
        options={[
          {
            testID: 'product-exit-consumed',
            label: plural ? 'Consommés' : 'Consommé',
            icon: (color) => <CircleCheckIcon size={18} color={color} />,
            tint: palette.freshText,
            onPress: onConsumed,
          },
          {
            testID: 'product-exit-discarded',
            label: plural ? 'Jetés' : 'Jeté',
            icon: (color) => <BanIcon size={18} color={color} />,
            tint: palette.soonText,
            onPress: () => setStep('discard'),
          },
          {
            testID: 'product-exit-correction',
            label: plural ? 'Supprimer — erreurs de saisie' : 'Supprimer — erreur de saisie',
            icon: (color) => <PencilIcon size={18} color={color} />,
            tint: palette.inkSecondary,
            onPress: onCorrection,
          },
        ]}
      />
    )
  }

  return (
    <ActionSheet
      visible={visible}
      onClose={onClose}
      title={`Jeter ${subject} ?`}
      options={[
        {
          testID: 'product-exit-discard-confirm',
          label: 'Jeter',
          icon: (color) => <BanIcon size={18} color={color} />,
          tint: palette.expired,
          destructive: true,
          onPress: () => onDiscarded({ discardReason: reason, amount }),
        },
      ]}
    >
      <YStack gap="$3" paddingHorizontal="$2" paddingBottom="$2">
        <Text fontSize={13} fontWeight="600" color={palette.inkSecondary}>
          Pourquoi ? (facultatif)
        </Text>
        <XStack gap="$3" flexWrap="wrap">
          {DISCARD_REASONS.map((value) => (
            <Chip
              key={value}
              testID={`product-exit-reason-${value}`}
              label={REASON_LABELS[value]}
              selected={reason === value}
              // A second tap takes the answer back: optional has to be undoable.
              onPress={() => setReason((current) => (current === value ? null : value))}
              palette={palette}
            />
          ))}
        </XStack>

        {single && stock !== null && amount !== null ? (
          <XStack alignItems="center" justifyContent="space-between" gap="$3" marginTop="$1">
            <Text fontSize={13} fontWeight="600" color={palette.inkSecondary}>
              Quantité jetée
            </Text>
            <XStack alignItems="center" gap="$2">
              <StepButton
                testID="product-exit-amount-decrease"
                label="−"
                accessibilityLabel="Un de moins"
                disabled={amount <= 1}
                onPress={() => setAmount(Math.max(1, amount - 1))}
              />
              <Text
                testID="product-exit-amount-value"
                fontSize={15}
                fontWeight="700"
                color={palette.ink}
                minWidth={72}
                textAlign="center"
                accessibilityLiveRegion="polite"
              >
                {amount} {single.quantity.unit}
              </Text>
              <StepButton
                testID="product-exit-amount-increase"
                label="+"
                accessibilityLabel="Un de plus"
                disabled={amount >= stock}
                onPress={() => setAmount(Math.min(stock, amount + 1))}
              />
            </XStack>
          </XStack>
        ) : null}
      </YStack>
    </ActionSheet>
  )
}

function StepButton({
  testID,
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  testID: string
  label: string
  accessibilityLabel: string
  disabled: boolean
  onPress: () => void
}) {
  const palette = useSoftPalette()
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={pointerCursor}
    >
      <YStack
        width={36}
        height={36}
        borderRadius={12}
        alignItems="center"
        justifyContent="center"
        backgroundColor={palette.gradientBottom}
        opacity={disabled ? 0.4 : 1}
      >
        <Text fontSize={18} fontWeight="800" color={palette.ink}>
          {label}
        </Text>
      </YStack>
    </Pressable>
  )
}
```

Expiry comes from `productStatus()` in `presentation/dashboard/product-status.ts`, never from `fridge-list-screen.tsx`'s `isExpired`: the list screen imports this sheet, so importing back from it would create a module cycle.

Palette tokens `freshText`, `soonText`, `expired`, `inkSecondary`, `gradientBottom` all exist today (used by the detail screen and `ActionSheet`); the exact tints get a look in Task 9's review.

- [ ] **Step 5: Run the sheet tests**

Run: same command as Step 3.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/presentation/shared/action-sheet.tsx mobile/src/presentation/fridge/product-exit-sheet.tsx mobile/src/presentation/fridge/product-exit-sheet.test.tsx
git commit -m "feat(mobile): ProductExitSheet — eaten, thrown away, or a data-entry mistake"
```

---

## Task 8: Wire the detail screen and the list's multi-select

**Files:**
- Modify: `mobile/src/presentation/fridge/fridge-detail-screen.tsx`
- Modify: `mobile/src/presentation/fridge/fridge-detail-screen.test.tsx`
- Modify: `mobile/src/presentation/fridge/fridge-list-screen.tsx`
- Modify: `mobile/src/presentation/fridge/fridge-list-screen.test.tsx`

**Interfaces:**
- Consumes: `useRecordProductOutcomeMutation` (Task 6), `ProductExitSheet` (Task 7).

- [ ] **Step 1: Rewrite the detail screen tests**

Replace the two delete tests in `fridge-detail-screen.test.tsx` (keep `renders the product name, quantity, and category`). Change `renderWithProviders` to accept an optional connector and return it:

```tsx
function renderWithProviders(children: ReactNode, connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return { connector, queryClient }
}
```

```tsx
test('eating one of several logs one unit and keeps the product on screen', async () => {
  const { connector } = renderWithProviders(<FridgeDetailScreen productId="fake-product-4" />)
  await waitFor(() => expect(screen.getByText('Yaourts nature')).toBeTruthy())

  fireEvent.press(screen.getByTestId('fridge-detail-consume'))

  await waitFor(() => expect(connector.outcomes).toHaveLength(1))
  expect(connector.outcomes[0]).toMatchObject({ kind: 'consumed', quantity: { amount: 1 } })
  expect(screen.queryByTestId('fridge-detail-gone')).toBeNull()
})

test('finishing the last unit needs no confirmation and leaves the screen', async () => {
  const { connector } = renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  fireEvent.press(screen.getByTestId('fridge-detail-consume'))

  await waitFor(() => expect(screen.getByTestId('fridge-detail-gone')).toBeTruthy())
  expect(screen.getByText('Produit terminé')).toBeTruthy()
  expect(connector.outcomes[0]).toMatchObject({ kind: 'consumed', quantity: { amount: 1 } })
})

test('thrown away past its date: reason pre-picked, part of the stock, the rest stays', async () => {
  const { connector } = renderWithProviders(<FridgeDetailScreen productId="fake-product-6" />)
  await waitFor(() => expect(screen.getByText('Jambon blanc')).toBeTruthy())

  fireEvent.press(screen.getByTestId('fridge-detail-remove'))
  fireEvent.press(screen.getByTestId('product-exit-discarded'))
  fireEvent.press(screen.getByTestId('product-exit-amount-decrease'))
  fireEvent.press(screen.getByTestId('product-exit-discard-confirm'))

  await waitFor(() => expect(connector.outcomes).toHaveLength(1))
  expect(connector.outcomes[0]).toMatchObject({ kind: 'discarded', discardReason: 'expired', quantity: { amount: 3 } })
  expect(screen.queryByTestId('fridge-detail-gone')).toBeNull()
})

test('a data-entry mistake deletes without logging anything', async () => {
  const connector = new FakeFridgeConnector()
  const deleteSpy = jest.spyOn(connector, 'deleteProduct')
  renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />, connector)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  fireEvent.press(screen.getByTestId('fridge-detail-remove'))
  fireEvent.press(screen.getByTestId('product-exit-correction'))

  await waitFor(() => expect(screen.getByText('Produit supprimé')).toBeTruthy())
  expect(deleteSpy).toHaveBeenCalledWith('fake-product-1')
  expect(connector.outcomes).toHaveLength(0)
})

test('a failed exit shows an inline error, stays on screen, and invalidates nothing', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'recordProductOutcome').mockResolvedValue({
    ok: false,
    error: { type: 'product_not_found', message: 'Produit introuvable.' },
  })
  const { queryClient } = renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />, connector)
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  fireEvent.press(screen.getByTestId('fridge-detail-consume'))

  await waitFor(() => expect(screen.getByTestId('fridge-detail-action-error')).toBeTruthy())
  expect(screen.queryByTestId('fridge-detail-gone')).toBeNull()
  expect(invalidateSpy).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd mobile && pnpm run test -- src/presentation/fridge/fridge-detail-screen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Detail screen implementation**

In `fridge-detail-screen.tsx`:

1. Update the file docblock's last sentence: finishing a product is now an outcome recorded for the foyer's statistics, and removal asks what became of it (ADR-0012).
2. Replace `useUpdateProductMutation`/`handleConsumeOne` and the delete confirmation state with:

```tsx
import { ProductExitSheet } from './product-exit-sheet.js'
import { useRecordProductOutcomeMutation } from '../../application/fridge/record-product-outcome.mutation.js'
import type { DiscardReason, RecordProductOutcomeInput } from '../../domain/fridge/product-outcome.js'

type Gone = 'consumed' | 'discarded' | 'deleted'

const GONE_COPY: Record<Gone, string> = {
  consumed: 'Produit terminé',
  discarded: 'Produit jeté',
  deleted: 'Produit supprimé',
}
```

```tsx
  const deleteProduct = useDeleteProductMutation()
  const recordOutcome = useRecordProductOutcomeMutation()
  const [hint, showHint] = useHint()
  const [exiting, setExiting] = useState(false)
  const [gone, setGone] = useState<Gone | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function leave(reason: Gone) {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    setGone(reason)
    router.back()
  }

  async function record(input: RecordProductOutcomeInput) {
    setExiting(false)
    setActionError(null)
    const result = await recordOutcome.mutateAsync({ productId, input })
    if (!result.ok) {
      setActionError(result.error.message)
      return
    }
    const remaining = result.value.product
    if (remaining === null) {
      leave(input.kind)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['product', productId] })
    showHint(`Il en reste ${remaining.quantity.amount} ${remaining.quantity.unit}`)
  }

  async function handleCorrection() {
    setExiting(false)
    setActionError(null)
    const result = await deleteProduct.mutateAsync(productId)
    if (!result.ok) {
      setActionError(result.error.message)
      return
    }
    leave('deleted')
  }

  function handleDiscarded({ discardReason, amount }: { discardReason: DiscardReason | null; amount: number | null }) {
    return record({ kind: 'discarded', discardReason, ...(amount === null ? {} : { amount }) })
  }
```

3. The `if (deleted)` frame becomes `if (gone)`: `testID="fridge-detail-gone"`, title `GONE_COPY[gone]`, subtitle unchanged.
4. Buttons:
   - `fridge-detail-consume`: `pending={recordOutcome.isPending}`, `onPress={() => record({ kind: 'consumed', amount: 1 })}` for both labels — no confirmation for the last unit.
   - `fridge-detail-edit`: unchanged.
   - The old `fridge-detail-delete` becomes `testID="fridge-detail-remove"`, same label « Retirer du garde-manger », `onPress={() => setExiting(true)}`.
   - Error text `testID="fridge-detail-action-error"` reading `actionError`.
5. Replace the old `<ActionSheet …/>` with:

```tsx
    <ProductExitSheet
      visible={exiting}
      products={[p]}
      onClose={() => setExiting(false)}
      onConsumed={() => record({ kind: 'consumed' })}
      onDiscarded={handleDiscarded}
      onCorrection={handleCorrection}
    />
```

Remove the now-unused imports (`ActionSheet`, `XIcon`, `useUpdateProductMutation`).

- [ ] **Step 4: Run the detail tests**

Run: same command as Step 2.
Expected: PASS.

- [ ] **Step 5: List screen test**

In `fridge-list-screen.test.tsx`, change `renderWithProviders` the same way (optional connector, returns it). The existing `a long press opens a selection…` test keeps passing unchanged (the sheet title is still `Retirer 2 produits ?`). Add:

```tsx
test('several products thrown away at once: one reason for all, each logged whole', async () => {
  const { connector } = renderWithProviders(<FridgeListScreen />)
  await waitFor(() => expect(screen.getByText('Jambon blanc')).toBeTruthy())

  fireEvent(screen.getByTestId('fridge-product-fake-product-6'), 'longPress')
  fireEvent.press(screen.getByTestId('fridge-product-fake-product-4'))
  fireEvent.press(screen.getByTestId('fridge-selection-remove'))

  fireEvent.press(screen.getByTestId('product-exit-discarded'))
  fireEvent.press(screen.getByTestId('product-exit-reason-spoiled'))
  fireEvent.press(screen.getByTestId('product-exit-discard-confirm'))

  await waitFor(() => expect(connector.outcomes).toHaveLength(2))
  expect(connector.outcomes.map((o) => [o.productId, o.discardReason, o.quantity.amount])).toEqual([
    ['fake-product-6', 'spoiled', 4],
    ['fake-product-4', 'spoiled', 4],
  ])
  await waitFor(() => expect(screen.queryByText('Jambon blanc')).toBeNull())
})

test('several data-entry mistakes are deleted, not logged', async () => {
  const { connector } = renderWithProviders(<FridgeListScreen />)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  fireEvent(screen.getByTestId('fridge-product-fake-product-1'), 'longPress')
  fireEvent.press(screen.getByTestId('fridge-selection-remove'))
  fireEvent.press(screen.getByTestId('product-exit-correction'))

  await waitFor(() => expect(screen.queryByText('Lait demi-écrémé')).toBeNull())
  expect(connector.outcomes).toHaveLength(0)
})
```

Order in the first assertion follows selection order (`selectedIds` is appended in tap order).

- [ ] **Step 6: List screen implementation**

In `fridge-list-screen.tsx`:

```tsx
import { ProductExitSheet } from './product-exit-sheet.js'
import { useRecordProductOutcomeMutation } from '../../application/fridge/record-product-outcome.mutation.js'
import type { DiscardReason } from '../../domain/fridge/product-outcome.js'
```

Rename `confirmingRemoval` → `exiting`, add `const recordOutcome = useRecordProductOutcomeMutation()`, and replace `handleRemoveSelected`:

```tsx
  type Exit = { kind: 'consumed' } | { kind: 'discarded'; discardReason: DiscardReason | null } | { kind: 'correction' }

  async function handleExitSelected(exit: Exit) {
    const ids = selectedIds
    setExiting(false)
    setSelectedIds([])
    // Sequential, not `Promise.all`: the connector talks to one household's
    // API, and a partial failure has to name how far it got rather than
    // scatter N simultaneous errors.
    const failures: string[] = []
    for (const id of ids) {
      const result =
        exit.kind === 'correction'
          ? await deleteProduct.mutateAsync(id)
          : await recordOutcome.mutateAsync({
              productId: id,
              input: exit.kind === 'discarded' ? { kind: 'discarded', discardReason: exit.discardReason } : { kind: 'consumed' },
            })
      if (!result.ok) failures.push(id)
    }
    await products.refetch()
    if (failures.length > 0) {
      showHint(`${failures.length} produit${failures.length > 1 ? 's n’ont' : ' n’a'} pas pu être retiré${failures.length > 1 ? 's' : ''}.`)
    }
  }

  const selectedProducts = (products.data ?? []).filter((product) => selectedIds.includes(product.id))
```

`SelectionBar`'s `onRemove={() => setExiting(true)}`. Replace the `<ActionSheet …/>` with:

```tsx
      <ProductExitSheet
        visible={exiting}
        products={selectedProducts}
        onClose={() => setExiting(false)}
        onConsumed={() => handleExitSelected({ kind: 'consumed' })}
        onDiscarded={({ discardReason }) => handleExitSelected({ kind: 'discarded', discardReason })}
        onCorrection={() => handleExitSelected({ kind: 'correction' })}
      />
```

`selectedProducts` must be computed before `setSelectedIds([])` clears it — it is read at render time, and the handlers capture `selectedIds` into `ids` first, so the sheet keeps its title until it closes. Remove the now-unused `BanIcon`/`ActionSheet` imports if nothing else uses them.

- [ ] **Step 7: Run all fridge presentation tests**

Run: `cd mobile && pnpm run test -- src/presentation/fridge`
Expected: PASS.

- [ ] **Step 8: Full mobile check**

Run: `task lint:mobile && task typecheck:mobile && task test:mobile && task boundaries:mobile`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/presentation/fridge
git commit -m "feat(mobile): ask what became of a product when it leaves the garde-manger"
```

---

## Task 9: Verification, design review, docs

**Files:**
- Modify: `docs/superpowers/specs/2026-09-13-product-outcome-design.md` (status line)
- Modify: `docs/roadmap-post-mvp.md` (chantier 1 status, if everything ships)

- [ ] **Step 1: Whole-repo check**

Run: `task check`
Expected: PASS on both packages.

- [ ] **Step 2: Run the app against the real backend**

Start the stack (`task dev`), then on the device or web build:
1. Open « Yaourts » (or any product with quantity > 1), tap « J'en ai consommé un » — hint shows the new count.
2. « Retirer du garde-manger » → « Jeté » → pick a reason, lower the amount, confirm — product stays with the rest.
3. Finish a one-unit product — no confirmation, back to the list.
4. Multi-select two products → « Consommés ».
5. « Supprimer — erreur de saisie » on a product.

Then check the log:

```bash
docker compose exec db psql -U postgres -d fridge -c "select kind, discard_reason, product_name, amount, price, recipe_id from product_outcome order by occurred_at"
```

Expected: one row per step 1–4 exit (two for step 4), none for step 5. Adjust the `psql` user/database to `compose.yml`'s values.

- [ ] **Step 3: Design review of the exit sheet**

Run the `impeccable` skill on `mobile/src/presentation/fridge/product-exit-sheet.tsx` and the detail screen: hierarchy of the correction row (must read secondary without looking disabled), tints of the three option chips against `DESIGN.md`, the stepper's touch targets and screen-reader labels, the two-step sheet on a small phone. Apply material fixes, re-run `task test:mobile`.

- [ ] **Step 4: Mark the spec implemented**

Change the status line to `**Statut :** implémenté (YYYY-MM-DD)` and note in `docs/roadmap-post-mvp.md` under chantier 1 that the log ships and stats are next.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs: mark product outcome log as implemented"
```
