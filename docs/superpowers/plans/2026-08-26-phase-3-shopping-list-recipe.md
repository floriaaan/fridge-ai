# Phase 3 — Shopping-list + Recipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the last two MVP bounded contexts — `shopping-list` (CRUD) and `recipe` (AI-generated + user-authored recipes) — completing the fridge-ai MVP v1 scope.

**Architecture:** Same DDD layering as Phase 1/2 (`src/{domain,application,infrastructure,presentation}`), same container-binding-per-provider-file DI pattern, same `Result<T,E>` error handling. `shopping-list` is a standalone CRUD context with no AI dependency. `recipe` reuses the exact hot-reload `ai-provider-registry` mechanism Phase 2 built for `ReceiptExtractionPort`, adding a parallel `RecipeGenerationPort` resolved the same way.

**Tech Stack:** AdonisJS 7 + Lucid + Postgres, VineJS validators, Japa tests, `@google/genai`/`openai`/`fetch` (Ollama) — all already installed from Phase 2.

**Spec:** [`docs/superpowers/specs/2026-08-26-phase-3-shopping-list-recipe-design.md`](../specs/2026-08-26-phase-3-shopping-list-recipe-design.md), which itself defers domain/DB/endpoint decisions to [`docs/phase-0/02-modele-de-domaine.md`](../../phase-0/02-modele-de-domaine.md), [`03-schema-base-de-donnees.md`](../../phase-0/03-schema-base-de-donnees.md), [`04-endpoints-http.md`](../../phase-0/04-endpoints-http.md).

## Global Constraints

- All new tables are scoped `household_id`, never `user_id` (cf. ADR-0003).
- Every route in both contexts sits behind `household_required_middleware` (401 no session, 403 no household) — same as `fridge`/`receipt`.
- `ShoppingItemSource` (`manual | auto_expired | recipe`) is accepted as client-supplied input, validated against the enum; no automatic trigger produces `auto_expired`/`recipe` items in v1 (ruling in the design spec, §4 — consistent with ADR-0010).
- `RecipeIngredient.productId` is always `null` for AI-generated ingredients in v1 — no fuzzy name-matching heuristic exists; the field stays nullable and forward-compatible.
- `recipe_ingredient.quantity` is an `INTEGER` column (phase-0 schema) — the AI can return fractional values, so the parser rounds them rather than rejecting the whole recipe.
- Reuse `Quantity` from `#domain/fridge/quantity.vo` for shopping items — same invariant (positive integer amount + non-empty unit), no need for a second VO.
- Error envelope: extend `STRING_ERROR_STATUS`/`STRING_ERROR_MESSAGES` in `src/presentation/shared/error-serializer.ts` in place — never a second serializer.
- Every functional test file wraps its group in `group.each.setup(() => db.beginGlobalTransaction())` / `group.each.teardown(() => db.rollbackGlobalTransaction())`, and defines its own local `signUpWithHousehold` helper (established Phase 2 convention — no shared test helper module).
- Follow `vine.date({ formats: { utc: true } })` wherever a date is accepted from the client (none needed in this phase — no date fields in either context).
- Run `pnpm run boundaries` (dependency-cruiser) after each task that adds files — no bounded-context-specific rules exist beyond the layering ones already enforced.

---

### Task 1: Migrations — `shopping_item`, `recipe`, `recipe_ingredient`

**Files:**
- Create: `backend/database/migrations/1785200000007_create_shopping_item_table.ts`
- Create: `backend/database/migrations/1785200000008_create_recipe_table.ts`
- Create: `backend/database/migrations/1785200000009_create_recipe_ingredient_table.ts`
- Modify: `backend/database/schema.ts` (auto-regenerated, do not hand-edit)

**Interfaces:**
- Produces: the three tables later tasks' Lucid models map onto, column-for-column matching `docs/phase-0/03-schema-base-de-donnees.md`.

- [ ] **Step 1: `shopping_item` table**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('shopping_item', (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('name').notNullable()
      table.integer('quantity').notNullable()
      table.text('unit').notNullable()
      table.boolean('checked').notNullable().defaultTo(false)
      table.text('source').notNullable().checkIn(['manual', 'auto_expired', 'recipe'])
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable('shopping_item', (table) => {
      table.index('household_id')
    })
  }

  async down() {
    this.schema.dropTable('shopping_item')
  }
}
```

- [ ] **Step 2: `recipe` table**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('recipe', (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('title').notNullable()
      table.text('description').nullable()
      table.text('source').notNullable().checkIn(['ai', 'user'])
      table.text('instructions').notNullable()
      table.integer('preparation_time').nullable()
      table.specificType('tags', 'text[]').notNullable().defaultTo('{}')
      table.text('image_key').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable('recipe', (table) => {
      table.index('household_id')
    })
  }

  async down() {
    this.schema.dropTable('recipe')
  }
}
```

- [ ] **Step 3: `recipe_ingredient` table**

```ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('recipe_ingredient', (table) => {
      table.text('id').primary()
      table.text('recipe_id').notNullable().references('id').inTable('recipe').onDelete('CASCADE')
      table.text('product_id').nullable().references('id').inTable('product').onDelete('SET NULL')
      table.text('label').notNullable()
      table.integer('quantity').nullable()
      table.text('unit').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable('recipe_ingredient', (table) => {
      table.index('recipe_id')
      table.index('product_id')
    })
  }

  async down() {
    this.schema.dropTable('recipe_ingredient')
  }
}
```

- [ ] **Step 4: Run the migrations and regenerate `database/schema.ts`**

Run: `cd backend && node ace migration:run`
Expected: all three migrations apply cleanly; `database/schema.ts` is rewritten by the `indexEntities` hook (do not hand-edit it — it's excluded from lint, cf. `eslint.config.js`).

Verify: `psql` or `node ace db:table shopping_item` (etc.) shows the columns above; or just proceed — Task 3/Task 6's repository tests will fail loudly if the schema is wrong.

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/1785200000007_create_shopping_item_table.ts \
  backend/database/migrations/1785200000008_create_recipe_table.ts \
  backend/database/migrations/1785200000009_create_recipe_ingredient_table.ts \
  backend/database/schema.ts
git commit -m "feat(db): shopping_item, recipe, recipe_ingredient migrations"
```

---

### Task 2: Domain — `shopping-list`

**Files:**
- Create: `backend/src/domain/shopping-list/shopping-item-source.vo.ts`
- Create: `backend/src/domain/shopping-list/shopping-item.entity.ts`
- Create: `backend/src/domain/shopping-list/interfaces/shopping-item-repository.interface.ts`
- Test: `backend/tests/unit/domain/shopping-list/shopping-item-source.vo.spec.ts`
- Test: `backend/tests/unit/domain/shopping-list/shopping-item.entity.spec.ts`

**Interfaces:**
- Consumes: `Quantity` from `#domain/fridge/quantity.vo` (unchanged), `ValueObject`/`AggregateRoot`/`Result`/`ValidationError` from `#domain/shared/*`.
- Produces: `ShoppingItem` (class, `AggregateRoot<string>`), `ShoppingItemSource` (class, `ValueObject`, `.value: ShoppingItemSourceValue`), `ShoppingItemRepository` (interface) — all consumed by Task 3.

- [ ] **Step 1: `ShoppingItemSource` value object**

`backend/src/domain/shopping-list/shopping-item-source.vo.ts`:

```ts
import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export type ShoppingItemSourceValue = 'manual' | 'auto_expired' | 'recipe'

const VALID_SOURCES: readonly ShoppingItemSourceValue[] = ['manual', 'auto_expired', 'recipe']

interface ShoppingItemSourceProps {
  value: ShoppingItemSourceValue
}

/**
 * v1 never *produces* `auto_expired`/`recipe` items automatically — no job
 * watches expiry, no endpoint bulk-adds missing recipe ingredients (design
 * spec §4, ADR-0010's YAGNI stance). The enum still validates all three
 * values so the schema doesn't lie about what's storable, and nothing
 * blocks wiring an automatic producer later.
 */
export class ShoppingItemSource extends ValueObject<ShoppingItemSourceProps> {
  private constructor(props: ShoppingItemSourceProps) {
    super(props)
  }

  static create(raw: string): Result<ShoppingItemSource, ValidationError> {
    if (!VALID_SOURCES.includes(raw as ShoppingItemSourceValue)) {
      return Result.err({ field: 'source', message: `"${raw}" n'est pas une source valide.` })
    }
    return Result.ok(new ShoppingItemSource({ value: raw as ShoppingItemSourceValue }))
  }

  get value(): ShoppingItemSourceValue {
    return this.props.value
  }
}
```

- [ ] **Step 2: Write the failing unit tests**

`backend/tests/unit/domain/shopping-list/shopping-item-source.vo.spec.ts`:

```ts
import { test } from '@japa/runner'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'

test.group('ShoppingItemSource', () => {
  test('accepts "manual"', ({ assert }) => {
    const result = ShoppingItemSource.create('manual')
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value.value, 'manual')
  })

  test('accepts "auto_expired" and "recipe"', ({ assert }) => {
    assert.isTrue(ShoppingItemSource.create('auto_expired').ok)
    assert.isTrue(ShoppingItemSource.create('recipe').ok)
  })

  test('rejects an unknown source', ({ assert }) => {
    const result = ShoppingItemSource.create('not-a-source')
    assert.isFalse(result.ok)
  })
})
```

`backend/tests/unit/domain/shopping-list/shopping-item.entity.spec.ts`:

```ts
import { test } from '@japa/runner'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import { Quantity } from '#domain/fridge/quantity.vo'

function buildItem() {
  const quantity = Quantity.create(1, 'kg')
  const source = ShoppingItemSource.create('manual')
  if (!quantity.ok || !source.ok) throw new Error('unreachable')

  return ShoppingItem.create({
    id: 's_1',
    householdId: 'h_1',
    name: 'Farine',
    quantity: quantity.value,
    source: source.value,
    createdAt: new Date('2026-08-26T10:00:00Z'),
  })
}

test.group('ShoppingItem', () => {
  test('create() starts unchecked and stamps updatedAt = createdAt', ({ assert }) => {
    const item = buildItem()
    assert.isFalse(item.checked)
    assert.equal(item.updatedAt.toISOString(), item.createdAt.toISOString())
  })

  test('toggle() flips checked and stamps updatedAt', ({ assert }) => {
    const item = buildItem()
    item.toggle(new Date('2026-08-26T11:00:00Z'))
    assert.isTrue(item.checked)
    assert.equal(item.updatedAt.toISOString(), '2026-08-26T11:00:00.000Z')

    item.toggle(new Date('2026-08-26T12:00:00Z'))
    assert.isFalse(item.checked)
  })

  test('update() merges the patch and stamps updatedAt', ({ assert }) => {
    const item = buildItem()
    item.update({ name: 'Farine T55' }, new Date('2026-08-26T11:00:00Z'))
    assert.equal(item.name, 'Farine T55')
    assert.equal(item.updatedAt.toISOString(), '2026-08-26T11:00:00.000Z')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && rtk proxy pnpm exec node ace test unit --files "tests/unit/domain/shopping-list/**"`
Expected: FAIL — `#domain/shopping-list/shopping-item.entity` (and `shopping-item-source.vo`) not found.

- [ ] **Step 4: `ShoppingItem` entity**

`backend/src/domain/shopping-list/shopping-item.entity.ts`:

```ts
import { AggregateRoot } from '#domain/shared/aggregate-root'
import type { Quantity } from '#domain/fridge/quantity.vo'
import type { ShoppingItemSource } from './shopping-item-source.vo.js'

interface ShoppingItemProps {
  householdId: string
  name: string
  quantity: Quantity
  checked: boolean
  source: ShoppingItemSource
  createdAt: Date
  updatedAt: Date
}

export interface CreateShoppingItemProps {
  id: string
  householdId: string
  name: string
  quantity: Quantity
  source: ShoppingItemSource
  createdAt: Date
}

export interface UpdateShoppingItemProps {
  name?: string
  quantity?: Quantity
}

export class ShoppingItem extends AggregateRoot<string> {
  private props: ShoppingItemProps

  private constructor(id: string, props: ShoppingItemProps) {
    super(id)
    this.props = props
  }

  static create(params: CreateShoppingItemProps): ShoppingItem {
    return new ShoppingItem(params.id, {
      householdId: params.householdId,
      name: params.name,
      quantity: params.quantity,
      checked: false,
      source: params.source,
      createdAt: params.createdAt,
      updatedAt: params.createdAt,
    })
  }

  static reconstruct(id: string, props: ShoppingItemProps): ShoppingItem {
    return new ShoppingItem(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }

  get name(): string {
    return this.props.name
  }

  get quantity(): Quantity {
    return this.props.quantity
  }

  get checked(): boolean {
    return this.props.checked
  }

  get source(): ShoppingItemSource {
    return this.props.source
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  update(patch: UpdateShoppingItemProps, updatedAt: Date): void {
    this.props = { ...this.props, ...patch, updatedAt }
  }

  toggle(updatedAt: Date): void {
    this.props = { ...this.props, checked: !this.props.checked, updatedAt }
  }
}
```

- [ ] **Step 5: `ShoppingItemRepository` port**

`backend/src/domain/shopping-list/interfaces/shopping-item-repository.interface.ts`:

```ts
import type { ShoppingItem } from '../shopping-item.entity.js'

export interface ShoppingItemRepository {
  findById(id: string): Promise<ShoppingItem | null>
  findByHousehold(householdId: string): Promise<ShoppingItem[]>
  save(item: ShoppingItem): Promise<void>
  delete(id: string): Promise<void>
}
```

- [ ] **Step 6: Run the tests to verify they pass, commit**

Run: `cd backend && rtk proxy pnpm exec node ace test unit --files "tests/unit/domain/shopping-list/**"`
Expected: PASS, 7 tests.

```bash
git add backend/src/domain/shopping-list backend/tests/unit/domain/shopping-list
git commit -m "feat(shopping-list): domain (ShoppingItem, ShoppingItemSource, port)"
```

---

### Task 3: `shopping-list` persistence, use-cases, presentation, wiring

**Files:**
- Create: `backend/src/infrastructure/database/shopping-list/shopping-item.lucid.ts`
- Create: `backend/src/infrastructure/database/shopping-list/shopping-item.mapper.ts`
- Create: `backend/src/infrastructure/database/shopping-list/shopping-item.repository.ts`
- Create: `backend/src/application/shopping-list/create-shopping-item.use-case.ts`
- Create: `backend/src/application/shopping-list/list-shopping-items.use-case.ts`
- Create: `backend/src/application/shopping-list/update-shopping-item.use-case.ts`
- Create: `backend/src/application/shopping-list/delete-shopping-item.use-case.ts`
- Create: `backend/src/presentation/shopping-list/shopping-item.dto.ts`
- Create: `backend/src/presentation/shopping-list/shopping-item.validator.ts`
- Create: `backend/src/presentation/shopping-list/shopping-item.controller.ts`
- Create: `backend/src/presentation/shopping-list/shopping-item.routes.ts`
- Create: `backend/providers/shopping_list_provider.ts`
- Modify: `backend/adonisrc.ts` (register provider)
- Modify: `backend/start/routes.ts` (import routes)
- Modify: `backend/src/presentation/shared/error-serializer.ts` (add `shopping_item_not_found`)
- Test: `backend/tests/infrastructure/shopping-list/shopping-item.repository.spec.ts`
- Test: `backend/tests/functional/shopping-list/shopping-item.spec.ts`

**Interfaces:**
- Consumes: `ShoppingItem`/`ShoppingItemSource`/`ShoppingItemRepository` (Task 2), `Quantity` (`#domain/fridge/quantity.vo`), `IdGenerator`/`Clock` (`#domain/shared/*`, bound as `shared.idGenerator`/`shared.clock`), `requireAuthenticatedUser`/`serializeError` (`#presentation/shared/*`), `middleware.householdRequired()` (`#start/kernel`).
- Produces: container binding `shoppingList.items: ShoppingItemRepository`, routes `GET/POST /api/shopping-items`, `PATCH/DELETE /api/shopping-items/:id`.

- [ ] **Step 1: Lucid model**

`backend/src/infrastructure/database/shopping-list/shopping-item.lucid.ts`:

```ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { ShoppingItemSourceValue } from '#domain/shopping-list/shopping-item-source.vo'

export default class ShoppingItemModel extends BaseModel {
  static table = 'shopping_item'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column()
  declare name: string

  @column()
  declare quantity: number

  @column()
  declare unit: string

  @column()
  declare checked: boolean

  @column()
  declare source: ShoppingItemSourceValue

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

- [ ] **Step 2: Mapper and repository**

`backend/src/infrastructure/database/shopping-list/shopping-item.mapper.ts`:

```ts
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import type ShoppingItemModel from './shopping-item.lucid.js'

export function toDomain(row: ShoppingItemModel): ShoppingItem {
  const quantity = Quantity.create(row.quantity, row.unit)
  if (!quantity.ok)
    throw new Error(`Corrupted shopping_item row ${row.id}: ${quantity.error.message}`)

  const source = ShoppingItemSource.create(row.source)
  if (!source.ok) throw new Error(`Corrupted shopping_item row ${row.id}: ${source.error.message}`)

  return ShoppingItem.reconstruct(row.id, {
    householdId: row.householdId,
    name: row.name,
    quantity: quantity.value,
    checked: row.checked,
    source: source.value,
    createdAt: row.createdAt.toJSDate(),
    updatedAt: row.updatedAt.toJSDate(),
  })
}
```

`backend/src/infrastructure/database/shopping-list/shopping-item.repository.ts`:

```ts
import ShoppingItemModel from './shopping-item.lucid.js'
import { toDomain } from './shopping-item.mapper.js'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'

export class LucidShoppingItemRepository implements ShoppingItemRepository {
  async findById(id: string): Promise<ShoppingItem | null> {
    const row = await ShoppingItemModel.find(id)
    return row ? toDomain(row) : null
  }

  async findByHousehold(householdId: string): Promise<ShoppingItem[]> {
    const rows = await ShoppingItemModel.query()
      .where('household_id', householdId)
      .orderBy('created_at', 'asc')
    return rows.map(toDomain)
  }

  async save(item: ShoppingItem): Promise<void> {
    await ShoppingItemModel.updateOrCreate(
      { id: item.id },
      {
        householdId: item.householdId,
        name: item.name,
        quantity: item.quantity.amount,
        unit: item.quantity.unit,
        checked: item.checked,
        source: item.source.value,
      },
    )
  }

  async delete(id: string): Promise<void> {
    await ShoppingItemModel.query().where('id', id).delete()
  }
}
```

- [ ] **Step 3: Write the failing repository test**

`backend/tests/infrastructure/shopping-list/shopping-item.repository.spec.ts`:

```ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidShoppingItemRepository } from '#infrastructure/database/shopping-list/shopping-item.repository'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'

async function createUser(id: string, email: string) {
  await db.table('user').insert({
    id,
    name: email,
    email,
    email_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  })
}

async function createHousehold(id: string, ownerId: string) {
  await db.table('household').insert({
    id,
    name: 'Test household',
    owner_id: ownerId,
    invite_code: id.slice(0, 8).toUpperCase().padEnd(8, '0'),
    created_at: new Date(),
    updated_at: new Date(),
  })
}

function buildItem(id: string, householdId: string, source = 'manual') {
  const quantity = Quantity.create(1, 'kg')
  const sourceVo = ShoppingItemSource.create(source)
  if (!quantity.ok || !sourceVo.ok) throw new Error('unreachable')

  return ShoppingItem.create({
    id,
    householdId,
    name: 'Farine',
    quantity: quantity.value,
    source: sourceVo.value,
    createdAt: new Date(),
  })
}

test.group('LucidShoppingItemRepository', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('save() then findById() round-trips an item', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')

    const repository = new LucidShoppingItemRepository()
    await repository.save(buildItem('s_1', 'h_1'))

    const found = await repository.findById('s_1')
    assert.equal(found?.name, 'Farine')
    assert.equal(found?.quantity.amount, 1)
    assert.isFalse(found?.checked)
  })

  test('findByHousehold() scopes to the household', async ({ assert }) => {
    await createUser('u_2', 'owner2@example.com')
    await createHousehold('h_2', 'u_2')
    await createUser('u_3', 'owner3@example.com')
    await createHousehold('h_3', 'u_3')

    const repository = new LucidShoppingItemRepository()
    await repository.save(buildItem('s_2', 'h_2'))
    await repository.save(buildItem('s_3', 'h_3'))

    const items = await repository.findByHousehold('h_2')
    assert.lengthOf(items, 1)
    assert.equal(items[0]?.id, 's_2')
  })

  test('delete() removes the row', async ({ assert }) => {
    await createUser('u_4', 'owner4@example.com')
    await createHousehold('h_4', 'u_4')

    const repository = new LucidShoppingItemRepository()
    await repository.save(buildItem('s_4', 'h_4'))
    await repository.delete('s_4')

    assert.isNull(await repository.findById('s_4'))
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd backend && rtk proxy pnpm exec node ace test unit --files "tests/infrastructure/shopping-list/**"`
Expected: FAIL — container/module not found (repository file doesn't exist until Step 2 lands; if run after Step 2, this instead validates against Task 1's migration).

- [ ] **Step 5: Use-cases**

`backend/src/application/shopping-list/create-shopping-item.use-case.ts`:

```ts
import type { UseCase } from '#application/shared/use-case'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface CreateShoppingItemInput {
  householdId: string
  name: string
  quantity: { amount: number; unit: string }
  source: string
}

export class CreateShoppingItem
  implements UseCase<CreateShoppingItemInput, ResultType<ShoppingItem, ValidationError>>
{
  constructor(
    private readonly items: ShoppingItemRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: CreateShoppingItemInput,
  ): Promise<ResultType<ShoppingItem, ValidationError>> {
    const quantity = Quantity.create(input.quantity.amount, input.quantity.unit)
    if (!quantity.ok) return quantity

    const source = ShoppingItemSource.create(input.source)
    if (!source.ok) return source

    const item = ShoppingItem.create({
      id: this.idGenerator.next(),
      householdId: input.householdId,
      name: input.name,
      quantity: quantity.value,
      source: source.value,
      createdAt: this.clock.now(),
    })

    await this.items.save(item)
    return Result.ok(item)
  }
}
```

`backend/src/application/shopping-list/list-shopping-items.use-case.ts`:

```ts
import type { UseCase } from '#application/shared/use-case'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'

export interface ListShoppingItemsInput {
  householdId: string
}

export class ListShoppingItems implements UseCase<ListShoppingItemsInput, ShoppingItem[]> {
  constructor(private readonly items: ShoppingItemRepository) {}

  async execute(input: ListShoppingItemsInput): Promise<ShoppingItem[]> {
    return this.items.findByHousehold(input.householdId)
  }
}
```

`backend/src/application/shopping-list/update-shopping-item.use-case.ts`:

```ts
import type { UseCase } from '#application/shared/use-case'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { Clock } from '#domain/shared/clock.interface'
import {
  type ShoppingItem,
  type UpdateShoppingItemProps,
} from '#domain/shopping-list/shopping-item.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface UpdateShoppingItemInput {
  householdId: string
  itemId: string
  name?: string
  quantity?: { amount: number; unit: string }
  checked?: boolean
}

export type UpdateShoppingItemError = 'shopping_item_not_found' | ValidationError

export class UpdateShoppingItem
  implements UseCase<UpdateShoppingItemInput, ResultType<ShoppingItem, UpdateShoppingItemError>>
{
  constructor(
    private readonly items: ShoppingItemRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: UpdateShoppingItemInput,
  ): Promise<ResultType<ShoppingItem, UpdateShoppingItemError>> {
    const item = await this.items.findById(input.itemId)
    if (!item || item.householdId !== input.householdId)
      return Result.err('shopping_item_not_found')

    const patch: UpdateShoppingItemProps = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.quantity !== undefined) {
      const quantity = Quantity.create(input.quantity.amount, input.quantity.unit)
      if (!quantity.ok) return quantity
      patch.quantity = quantity.value
    }

    const now = this.clock.now()
    if (Object.keys(patch).length > 0) item.update(patch, now)
    if (input.checked !== undefined && input.checked !== item.checked) item.toggle(now)

    await this.items.save(item)
    return Result.ok(item)
  }
}
```

`backend/src/application/shopping-list/delete-shopping-item.use-case.ts`:

```ts
import type { UseCase } from '#application/shared/use-case'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface DeleteShoppingItemInput {
  householdId: string
  itemId: string
}

export type DeleteShoppingItemError = 'shopping_item_not_found'

export class DeleteShoppingItem
  implements UseCase<DeleteShoppingItemInput, ResultType<void, DeleteShoppingItemError>>
{
  constructor(private readonly items: ShoppingItemRepository) {}

  async execute(
    input: DeleteShoppingItemInput,
  ): Promise<ResultType<void, DeleteShoppingItemError>> {
    const item = await this.items.findById(input.itemId)
    if (!item || item.householdId !== input.householdId)
      return Result.err('shopping_item_not_found')
    await this.items.delete(item.id)
    return Result.ok(undefined)
  }
}
```

- [ ] **Step 6: DTO, validator, controller, routes**

`backend/src/presentation/shopping-list/shopping-item.dto.ts`:

```ts
import type { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'

export interface ShoppingItemDto {
  id: string
  name: string
  quantity: { amount: number; unit: string }
  checked: boolean
  source: string
  createdAt: string
  updatedAt: string
}

export function toShoppingItemDto(item: ShoppingItem): ShoppingItemDto {
  return {
    id: item.id,
    name: item.name,
    quantity: { amount: item.quantity.amount, unit: item.quantity.unit },
    checked: item.checked,
    source: item.source.value,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}
```

`backend/src/presentation/shopping-list/shopping-item.validator.ts`:

```ts
import vine from '@vinejs/vine'

const quantitySchema = vine.object({
  amount: vine.number().positive(),
  unit: vine.string().trim().minLength(1),
})
const sourceSchema = vine.enum(['manual', 'auto_expired', 'recipe'] as const)

export const createShoppingItemValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    quantity: quantitySchema,
    source: sourceSchema,
  }),
)

export const updateShoppingItemValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120).optional(),
    quantity: quantitySchema.optional(),
    checked: vine.boolean().optional(),
  }),
)
```

`backend/src/presentation/shopping-list/shopping-item.controller.ts`:

```ts
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { createShoppingItemValidator, updateShoppingItemValidator } from './shopping-item.validator.js'
import { toShoppingItemDto } from './shopping-item.dto.js'
import { CreateShoppingItem } from '#application/shopping-list/create-shopping-item.use-case'
import { ListShoppingItems } from '#application/shopping-list/list-shopping-items.use-case'
import { UpdateShoppingItem } from '#application/shopping-list/update-shopping-item.use-case'
import { DeleteShoppingItem } from '#application/shopping-list/delete-shopping-item.use-case'

export default class ShoppingItemController {
  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const items = await ctx.containerResolver.make('shoppingList.items')
    const result = await new ListShoppingItems(items).execute({ householdId: ctx.household.id })
    return ctx.response.json({ items: result.map(toShoppingItemDto) })
  }

  async store(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(201).json({ item: toShoppingItemDto(result.value) })
  }

  async update(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ item: toShoppingItemDto(result.value) })
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const items = await ctx.containerResolver.make('shoppingList.items')
    const result = await new DeleteShoppingItem(items).execute({
      householdId: ctx.household.id,
      itemId: ctx.params.id,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(204).send('')
  }
}
```

`backend/src/presentation/shopping-list/shopping-item.routes.ts`:

```ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ShoppingItemController = () => import('./shopping-item.controller.js')

router
  .group(() => {
    router.get('/shopping-items', [ShoppingItemController, 'index'])
    router.post('/shopping-items', [ShoppingItemController, 'store'])
    router.patch('/shopping-items/:id', [ShoppingItemController, 'update'])
    router.delete('/shopping-items/:id', [ShoppingItemController, 'destroy'])
  })
  .prefix('/api')
  .use([middleware.householdRequired()])
```

- [ ] **Step 7: Provider, `adonisrc.ts`, `start/routes.ts`, error-serializer**

`backend/providers/shopping_list_provider.ts`:

```ts
import type { ApplicationService } from '@adonisjs/core/types'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'

export default class ShoppingListProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('shoppingList.items', async () => {
      const { LucidShoppingItemRepository } = await import(
        '#infrastructure/database/shopping-list/shopping-item.repository'
      )
      return new LucidShoppingItemRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'shoppingList.items': ShoppingItemRepository
  }
}
```

In `backend/adonisrc.ts`, add to `providers` after `#providers/receipt_provider`:

```ts
    () => import('#providers/shopping_list_provider'),
```

In `backend/start/routes.ts`, add:

```ts
import '#presentation/shopping-list/shopping-item.routes'
```

In `backend/src/presentation/shared/error-serializer.ts`, add to `STRING_ERROR_STATUS`:

```ts
  shopping_item_not_found: 404,
```

and to `STRING_ERROR_MESSAGES`:

```ts
  shopping_item_not_found: 'Article introuvable.',
```

- [ ] **Step 8: Functional test**

`backend/tests/functional/shopping-list/shopping-item.spec.ts`:

```ts
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
```

- [ ] **Step 9: Run the full suite, boundaries, commit**

Run: `cd backend && rtk proxy task check`
Expected: PASS — lint, typecheck, all tests (including the new shopping-list ones), boundaries clean.

```bash
git add backend/src/infrastructure/database/shopping-list backend/src/application/shopping-list \
  backend/src/presentation/shopping-list backend/providers/shopping_list_provider.ts \
  backend/adonisrc.ts backend/start/routes.ts backend/src/presentation/shared/error-serializer.ts \
  backend/tests/infrastructure/shopping-list backend/tests/functional/shopping-list
git commit -m "feat(shopping-list): persistence, use-cases, HTTP endpoints"
```

---

### Task 4: Domain — `recipe`

**Files:**
- Create: `backend/src/domain/recipe/recipe-source.vo.ts`
- Create: `backend/src/domain/recipe/recipe-ingredient.entity.ts`
- Create: `backend/src/domain/recipe/recipe.aggregate.ts`
- Create: `backend/src/domain/recipe/recipe-draft.ts`
- Create: `backend/src/domain/recipe/recipe-generation.errors.ts`
- Create: `backend/src/domain/recipe/recipe-generation-prompt.ts`
- Create: `backend/src/domain/recipe/recipe-draft-parser.ts`
- Create: `backend/src/domain/recipe/interfaces/recipe-repository.interface.ts`
- Create: `backend/src/domain/recipe/interfaces/recipe-generation-port.interface.ts`
- Test: `backend/tests/unit/domain/recipe/recipe-source.vo.spec.ts`
- Test: `backend/tests/unit/domain/recipe/recipe.aggregate.spec.ts`
- Test: `backend/tests/unit/domain/recipe/recipe-draft-parser.spec.ts`

**Interfaces:**
- Consumes: `AggregateRoot`/`Entity`/`ValueObject`/`Result`/`ValidationError` from `#domain/shared/*`.
- Produces: `Recipe` (`AggregateRoot<string>`), `RecipeIngredient` (`Entity<string>`), `RecipeSource` (VO), `RecipeDraft`/`RecipeDraftIngredient` (plain interfaces), `RecipeGenerationPort`/`RecipeGenerationContext` (interfaces), `RecipeRepository` (interface), `buildRecipeGenerationPrompt`, `parseRecipeDraftsJson` — all consumed by Task 5 (adapters), Task 6 (persistence), Task 7 (use-cases).

- [ ] **Step 1: `RecipeSource` value object**

`backend/src/domain/recipe/recipe-source.vo.ts`:

```ts
import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export type RecipeSourceValue = 'ai' | 'user'

const VALID_SOURCES: readonly RecipeSourceValue[] = ['ai', 'user']

interface RecipeSourceProps {
  value: RecipeSourceValue
}

/**
 * A VO (not a plain string-union type like `HouseholdRole`/`AiProvider`)
 * because `source` is client-supplied on `POST /api/recipes` (saving a
 * manual recipe) and needs the same runtime validation as `Location`.
 */
export class RecipeSource extends ValueObject<RecipeSourceProps> {
  private constructor(props: RecipeSourceProps) {
    super(props)
  }

  static create(raw: string): Result<RecipeSource, ValidationError> {
    if (!VALID_SOURCES.includes(raw as RecipeSourceValue)) {
      return Result.err({ field: 'source', message: `"${raw}" n'est pas une source valide.` })
    }
    return Result.ok(new RecipeSource({ value: raw as RecipeSourceValue }))
  }

  get value(): RecipeSourceValue {
    return this.props.value
  }
}
```

- [ ] **Step 2: `RecipeDraft`, generation errors, prompt builder, parser**

`backend/src/domain/recipe/recipe-draft.ts`:

```ts
/** Never persisted as-is — one element of the raw result of `RecipeGenerationPort.generate()`. */
export interface RecipeDraftIngredient {
  label: string
  productId: string | null
  quantity: number | null
  unit: string | null
}

export interface RecipeDraft {
  title: string
  description: string | null
  instructions: string
  preparationTime: number | null
  tags: string[]
  ingredients: RecipeDraftIngredient[]
}
```

`backend/src/domain/recipe/recipe-generation.errors.ts`:

```ts
/**
 * Domain-owned (not infrastructure-owned) specifically so the application
 * layer can import these without violating the `application-only-depends-
 * on-domain` dependency-cruiser rule — mirrors `receipt-extraction.errors.ts`.
 * Task 5's three AI adapters throw them, Task 7's `GenerateRecipes`/
 * `SuggestRecipes` use-cases catch them.
 */
export class RecipeGenerationUnavailableError extends Error {
  constructor(public readonly provider: string) {
    super(`Recipe generation provider "${provider}" has no credentials configured.`)
  }
}

export class RecipeGenerationParseError extends Error {}
```

`backend/src/domain/recipe/interfaces/recipe-generation-port.interface.ts`:

```ts
import type { RecipeDraft } from '../recipe-draft.js'

export interface RecipeGenerationProduct {
  name: string
  category: string
  expiresAt: Date | null
}

export interface RecipeGenerationContext {
  products: RecipeGenerationProduct[]
  prompt?: string
  prioritizeExpiringSoon: boolean
}

export interface RecipeGenerationPort {
  generate(context: RecipeGenerationContext): Promise<RecipeDraft[]>
}
```

`backend/src/domain/recipe/recipe-generation-prompt.ts`:

```ts
import type { RecipeGenerationContext } from './interfaces/recipe-generation-port.interface.js'

const BASE_INSTRUCTIONS = `Tu es un assistant culinaire. Propose des recettes réalisables avec les produits fournis (des produits de base courants sont acceptables en complément). Retourne UNIQUEMENT un JSON de la forme :
[{"title": string, "description": string | null, "instructions": string, "preparationTime": number | null, "tags": string[], "ingredients": [{"label": string, "quantity": number | null, "unit": string | null}]}]
Pas de texte hors du JSON. Propose entre 1 et 3 recettes.`

/**
 * Shared by all three `RecipeGenerationPort` adapters (Task 5) — one place
 * builds the prompt from context, the same role `receipt-draft-parser.ts`
 * plays for parsing on the `ReceiptExtractionPort` side.
 */
export function buildRecipeGenerationPrompt(context: RecipeGenerationContext): string {
  const productLines = context.products
    .map(
      (p) =>
        `- ${p.name} (${p.category}${p.expiresAt ? `, périme le ${p.expiresAt.toISOString().slice(0, 10)}` : ''})`,
    )
    .join('\n')

  const parts = [
    BASE_INSTRUCTIONS,
    `Produits actuellement dans le foyer :\n${productLines || '(aucun produit)'}`,
  ]

  if (context.prioritizeExpiringSoon) {
    parts.push('Priorise les recettes qui utilisent les produits proches de la péremption.')
  }
  if (context.prompt) {
    parts.push(`Demande spécifique de l'utilisateur : ${context.prompt}`)
  }

  return parts.join('\n\n')
}
```

`backend/src/domain/recipe/recipe-draft-parser.ts`:

```ts
import type { RecipeDraft, RecipeDraftIngredient } from './recipe-draft.js'
import { RecipeGenerationParseError } from './recipe-generation.errors.js'

interface RawRecipeDraft {
  title?: unknown
  description?: unknown
  instructions?: unknown
  preparationTime?: unknown
  tags?: unknown
  ingredients?: unknown
}

/** Models sometimes wrap JSON in a ```json fenced block despite instructions — strip it. */
function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced?.[1] ? fenced[1].trim() : text.trim()
}

function parseIngredient(
  raw: unknown,
  recipeIndex: number,
  ingredientIndex: number,
): RecipeDraftIngredient {
  if (typeof raw !== 'object' || raw === null) {
    throw new RecipeGenerationParseError(
      `recipe ${recipeIndex} ingredient ${ingredientIndex} is not an object`,
    )
  }
  const record = raw as Record<string, unknown>
  if (typeof record.label !== 'string') {
    throw new RecipeGenerationParseError(
      `recipe ${recipeIndex} ingredient ${ingredientIndex} is missing "label"`,
    )
  }
  return {
    label: record.label,
    // The AI never guesses a productId — no fuzzy name-matching heuristic
    // exists in v1 (Global Constraints; ADR-0010's "not built until a real
    // use-case needs it" stance). The field stays nullable and forward-compatible.
    productId: null,
    // `recipe_ingredient.quantity` is an INTEGER column (docs/phase-0/03) —
    // round rather than reject a whole recipe over a fractional AI value.
    quantity: typeof record.quantity === 'number' ? Math.round(record.quantity) : null,
    unit: typeof record.unit === 'string' ? record.unit : null,
  }
}

function parseDraft(raw: unknown, index: number): RecipeDraft {
  if (typeof raw !== 'object' || raw === null) {
    throw new RecipeGenerationParseError(`recipe ${index} is not an object`)
  }
  const record = raw as RawRecipeDraft
  if (
    typeof record.title !== 'string' ||
    typeof record.instructions !== 'string' ||
    !Array.isArray(record.ingredients)
  ) {
    throw new RecipeGenerationParseError(`recipe ${index} is missing required fields`)
  }
  return {
    title: record.title,
    description: typeof record.description === 'string' ? record.description : null,
    instructions: record.instructions,
    preparationTime: typeof record.preparationTime === 'number' ? record.preparationTime : null,
    tags: Array.isArray(record.tags)
      ? record.tags.filter((t): t is string => typeof t === 'string')
      : [],
    ingredients: record.ingredients.map((i, ingredientIndex) =>
      parseIngredient(i, index, ingredientIndex),
    ),
  }
}

/**
 * Turns a text model's raw response into validated `RecipeDraft[]` — shared
 * by all three `RecipeGenerationPort` adapters (Task 5).
 */
export function parseRecipeDraftsJson(text: string): RecipeDraft[] {
  const jsonText = extractJsonBlock(text)
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new RecipeGenerationParseError('AI response was not valid JSON')
  }

  if (!Array.isArray(raw)) {
    throw new RecipeGenerationParseError('AI response is not a JSON array of recipes')
  }
  if (raw.length === 0) {
    throw new RecipeGenerationParseError('AI response contained no recipes')
  }

  return raw.map(parseDraft)
}
```

- [ ] **Step 3: Write the failing unit tests**

`backend/tests/unit/domain/recipe/recipe-source.vo.spec.ts`:

```ts
import { test } from '@japa/runner'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'

test.group('RecipeSource', () => {
  test('accepts "ai" and "user"', ({ assert }) => {
    assert.isTrue(RecipeSource.create('ai').ok)
    assert.isTrue(RecipeSource.create('user').ok)
  })

  test('rejects an unknown source', ({ assert }) => {
    assert.isFalse(RecipeSource.create('community').ok)
  })
})
```

`backend/tests/unit/domain/recipe/recipe-draft-parser.spec.ts`:

```ts
import { test } from '@japa/runner'
import { parseRecipeDraftsJson } from '#domain/recipe/recipe-draft-parser'
import { RecipeGenerationParseError } from '#domain/recipe/recipe-generation.errors'

const VALID_JSON = JSON.stringify([
  {
    title: 'Gratin de courgettes',
    description: null,
    instructions: 'Couper, cuire, gratiner.',
    preparationTime: 30,
    tags: ['végétarien'],
    ingredients: [{ label: 'Courgette', quantity: 2, unit: 'piece' }],
  },
])

test.group('parseRecipeDraftsJson', () => {
  test('parses a well-formed AI response', ({ assert }) => {
    const drafts = parseRecipeDraftsJson(VALID_JSON)
    assert.lengthOf(drafts, 1)
    assert.equal(drafts[0]?.title, 'Gratin de courgettes')
    assert.lengthOf(drafts[0]?.ingredients ?? [], 1)
    assert.isNull(drafts[0]?.ingredients[0]?.productId)
  })

  test('rounds a fractional ingredient quantity', ({ assert }) => {
    const json = JSON.stringify([
      {
        title: 'Soupe',
        description: null,
        instructions: 'Mixer.',
        preparationTime: null,
        tags: [],
        ingredients: [{ label: 'Carotte', quantity: 2.6, unit: 'piece' }],
      },
    ])
    const drafts = parseRecipeDraftsJson(json)
    assert.equal(drafts[0]?.ingredients[0]?.quantity, 3)
  })

  test('strips a ```json fenced code block some models wrap the response in', ({ assert }) => {
    const drafts = parseRecipeDraftsJson(`Voici le résultat:\n\`\`\`json\n${VALID_JSON}\n\`\`\``)
    assert.equal(drafts[0]?.title, 'Gratin de courgettes')
  })

  test('throws RecipeGenerationParseError on invalid JSON', ({ assert }) => {
    assert.throws(() => parseRecipeDraftsJson('not json'), RecipeGenerationParseError)
  })

  test('throws RecipeGenerationParseError when the response is not an array', ({ assert }) => {
    assert.throws(
      () => parseRecipeDraftsJson(JSON.stringify({ title: 'X' })),
      RecipeGenerationParseError,
    )
  })

  test('throws RecipeGenerationParseError on an empty array', ({ assert }) => {
    assert.throws(() => parseRecipeDraftsJson('[]'), RecipeGenerationParseError)
  })

  test('throws RecipeGenerationParseError when a recipe is missing required fields', ({
    assert,
  }) => {
    assert.throws(
      () => parseRecipeDraftsJson(JSON.stringify([{ title: 'X' }])),
      RecipeGenerationParseError,
    )
  })
})
```

Run: `cd backend && rtk proxy pnpm exec node ace test unit --files "tests/unit/domain/recipe/**"`
Expected: FAIL — `#domain/recipe/*` not found.

- [ ] **Step 4: `RecipeIngredient` entity and `Recipe` aggregate**

`backend/src/domain/recipe/recipe-ingredient.entity.ts`:

```ts
import { Entity } from '#domain/shared/entity'

interface RecipeIngredientProps {
  recipeId: string
  productId: string | null
  label: string
  quantity: number | null
  unit: string | null
}

export class RecipeIngredient extends Entity<string> {
  private props: RecipeIngredientProps

  private constructor(id: string, props: RecipeIngredientProps) {
    super(id)
    this.props = props
  }

  static create(id: string, props: RecipeIngredientProps): RecipeIngredient {
    return new RecipeIngredient(id, props)
  }

  get recipeId(): string {
    return this.props.recipeId
  }

  get productId(): string | null {
    return this.props.productId
  }

  get label(): string {
    return this.props.label
  }

  get quantity(): number | null {
    return this.props.quantity
  }

  get unit(): string | null {
    return this.props.unit
  }
}
```

`backend/src/domain/recipe/recipe.aggregate.ts`:

```ts
import { AggregateRoot } from '#domain/shared/aggregate-root'
import { RecipeIngredient } from './recipe-ingredient.entity.js'
import type { RecipeSource } from './recipe-source.vo.js'

interface RecipeProps {
  householdId: string
  title: string
  description: string | null
  source: RecipeSource
  instructions: string
  preparationTime: number | null
  tags: string[]
  imageKey: string | null
  ingredients: RecipeIngredient[]
  createdAt: Date
}

export interface CreateRecipeIngredientProps {
  id: string
  productId?: string | null
  label: string
  quantity?: number | null
  unit?: string | null
}

export interface CreateRecipeProps {
  id: string
  householdId: string
  title: string
  source: RecipeSource
  instructions: string
  ingredients: CreateRecipeIngredientProps[]
  description?: string | null
  preparationTime?: number | null
  tags?: string[]
  imageKey?: string | null
  createdAt: Date
}

export class Recipe extends AggregateRoot<string> {
  private props: RecipeProps

  private constructor(id: string, props: RecipeProps) {
    super(id)
    this.props = props
  }

  static create(params: CreateRecipeProps): Recipe {
    const ingredients = params.ingredients.map((i) =>
      RecipeIngredient.create(i.id, {
        recipeId: params.id,
        productId: i.productId ?? null,
        label: i.label,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
      }),
    )

    return new Recipe(params.id, {
      householdId: params.householdId,
      title: params.title,
      description: params.description ?? null,
      source: params.source,
      instructions: params.instructions,
      preparationTime: params.preparationTime ?? null,
      tags: params.tags ?? [],
      imageKey: params.imageKey ?? null,
      ingredients,
      createdAt: params.createdAt,
    })
  }

  /** Rehydrates an aggregate from persisted state — used by the mapper (Task 6). */
  static reconstruct(id: string, props: RecipeProps): Recipe {
    return new Recipe(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }

  get title(): string {
    return this.props.title
  }

  get description(): string | null {
    return this.props.description
  }

  get source(): RecipeSource {
    return this.props.source
  }

  get instructions(): string {
    return this.props.instructions
  }

  get preparationTime(): number | null {
    return this.props.preparationTime
  }

  get tags(): string[] {
    return this.props.tags
  }

  get imageKey(): string | null {
    return this.props.imageKey
  }

  get ingredients(): RecipeIngredient[] {
    return this.props.ingredients
  }

  get createdAt(): Date {
    return this.props.createdAt
  }
}
```

- [ ] **Step 5: `RecipeRepository` port**

`backend/src/domain/recipe/interfaces/recipe-repository.interface.ts`:

```ts
import type { Recipe } from '../recipe.aggregate.js'

export interface RecipeRepository {
  findById(id: string): Promise<Recipe | null>
  findByHousehold(householdId: string): Promise<Recipe[]>
  save(recipe: Recipe): Promise<void>
  delete(id: string): Promise<void>
}
```

- [ ] **Step 6: `Recipe.aggregate.spec.ts`, run all tests, commit**

`backend/tests/unit/domain/recipe/recipe.aggregate.spec.ts`:

```ts
import { test } from '@japa/runner'
import { Recipe } from '#domain/recipe/recipe.aggregate'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'

function buildRecipe() {
  const source = RecipeSource.create('user')
  if (!source.ok) throw new Error('unreachable')

  return Recipe.create({
    id: 'rc_1',
    householdId: 'h_1',
    title: 'Gratin de courgettes',
    source: source.value,
    instructions: 'Couper, cuire, gratiner.',
    ingredients: [{ id: 'ri_1', label: 'Courgette', quantity: 2, unit: 'piece' }],
    createdAt: new Date('2026-08-26T10:00:00Z'),
  })
}

test.group('Recipe', () => {
  test('create() defaults optional fields', ({ assert }) => {
    const recipe = buildRecipe()
    assert.isNull(recipe.description)
    assert.isNull(recipe.preparationTime)
    assert.isNull(recipe.imageKey)
    assert.deepEqual(recipe.tags, [])
  })

  test('create() builds internal RecipeIngredient entities scoped to the recipe', ({ assert }) => {
    const recipe = buildRecipe()
    assert.lengthOf(recipe.ingredients, 1)
    assert.equal(recipe.ingredients[0]?.recipeId, recipe.id)
    assert.equal(recipe.ingredients[0]?.label, 'Courgette')
    assert.isNull(recipe.ingredients[0]?.productId)
  })
})
```

Run: `cd backend && rtk proxy pnpm exec node ace test unit --files "tests/unit/domain/recipe/**"`
Expected: PASS, all tests green.

```bash
git add backend/src/domain/recipe backend/tests/unit/domain/recipe
git commit -m "feat(recipe): domain (Recipe, RecipeIngredient, RecipeSource, drafts, ports)"
```

---

### Task 5: AI adapters for `RecipeGenerationPort` + `ai-provider-registry` extension

**Files:**
- Create: `backend/src/infrastructure/settings/gemini-recipe-generation.adapter.ts`
- Create: `backend/src/infrastructure/settings/openai-recipe-generation.adapter.ts`
- Create: `backend/src/infrastructure/settings/ollama-recipe-generation.adapter.ts`
- Modify: `backend/src/infrastructure/settings/ai-provider-registry.ts`
- Modify: `backend/start/env.ts` (add `OLLAMA_TEXT_MODEL`)
- Test: `backend/tests/infrastructure/settings/ai-provider-registry.spec.ts` (extend)

**Interfaces:**
- Consumes: `RecipeGenerationPort`/`RecipeGenerationContext` (Task 4), `RecipeDraft` (Task 4), `buildRecipeGenerationPrompt`/`parseRecipeDraftsJson` (Task 4), `RecipeGenerationUnavailableError` (Task 4), `AiSettingsProvider`/`AiProvider` (existing Phase 2 settings context).
- Produces: `resolveRecipeGenerationAdapter(settings): Promise<RecipeGenerationPort>`, `__setRecipeGenerationOverrideForTests(port | null): void` — consumed by Task 7 (`providers/settings_provider.ts` binding) and functional tests.

- [ ] **Step 1: Three adapters**

`backend/src/infrastructure/settings/gemini-recipe-generation.adapter.ts`:

```ts
import { GoogleGenAI } from '@google/genai'
import type {
  RecipeGenerationPort,
  RecipeGenerationContext,
} from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'
import { buildRecipeGenerationPrompt } from '#domain/recipe/recipe-generation-prompt'
import { parseRecipeDraftsJson } from '#domain/recipe/recipe-draft-parser'
import { RecipeGenerationUnavailableError } from '#domain/recipe/recipe-generation.errors'

export class GeminiRecipeGenerationAdapter implements RecipeGenerationPort {
  constructor(private readonly apiKey: string) {}

  async generate(context: RecipeGenerationContext): Promise<RecipeDraft[]> {
    if (!this.apiKey) throw new RecipeGenerationUnavailableError('gemini')

    const client = new GoogleGenAI({ apiKey: this.apiKey })
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: buildRecipeGenerationPrompt(context) }] }],
    })

    return parseRecipeDraftsJson(response.text ?? '')
  }
}
```

`backend/src/infrastructure/settings/openai-recipe-generation.adapter.ts`:

```ts
import OpenAI from 'openai'
import type {
  RecipeGenerationPort,
  RecipeGenerationContext,
} from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'
import { buildRecipeGenerationPrompt } from '#domain/recipe/recipe-generation-prompt'
import { parseRecipeDraftsJson } from '#domain/recipe/recipe-draft-parser'
import { RecipeGenerationUnavailableError } from '#domain/recipe/recipe-generation.errors'

export class OpenAiRecipeGenerationAdapter implements RecipeGenerationPort {
  constructor(private readonly apiKey: string) {}

  async generate(context: RecipeGenerationContext): Promise<RecipeDraft[]> {
    if (!this.apiKey) throw new RecipeGenerationUnavailableError('openai')

    const client = new OpenAI({ apiKey: this.apiKey })
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildRecipeGenerationPrompt(context) }],
    })

    return parseRecipeDraftsJson(response.choices[0]?.message.content ?? '')
  }
}
```

`backend/src/infrastructure/settings/ollama-recipe-generation.adapter.ts`:

```ts
import type {
  RecipeGenerationPort,
  RecipeGenerationContext,
} from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'
import { buildRecipeGenerationPrompt } from '#domain/recipe/recipe-generation-prompt'
import { parseRecipeDraftsJson } from '#domain/recipe/recipe-draft-parser'
import { RecipeGenerationUnavailableError } from '#domain/recipe/recipe-generation.errors'

export class OllamaRecipeGenerationAdapter implements RecipeGenerationPort {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async generate(context: RecipeGenerationContext): Promise<RecipeDraft[]> {
    if (!this.model) throw new RecipeGenerationUnavailableError('ollama')

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: buildRecipeGenerationPrompt(context),
        stream: false,
      }),
    })
    if (!response.ok) throw new RecipeGenerationUnavailableError('ollama')

    const body = (await response.json()) as { response?: string }
    return parseRecipeDraftsJson(body.response ?? '')
  }
}
```

- [ ] **Step 2: `OLLAMA_TEXT_MODEL` env var**

In `backend/start/env.ts`, add right after `OLLAMA_VISION_MODEL`:

```ts
  OLLAMA_TEXT_MODEL: Env.schema.string.optional(),
```

- [ ] **Step 3: Extend `ai-provider-registry.ts`**

Append to `backend/src/infrastructure/settings/ai-provider-registry.ts` (keep the existing receipt-extraction exports untouched above this point):

```ts
import { GeminiRecipeGenerationAdapter } from './gemini-recipe-generation.adapter.js'
import { OpenAiRecipeGenerationAdapter } from './openai-recipe-generation.adapter.js'
import { OllamaRecipeGenerationAdapter } from './ollama-recipe-generation.adapter.js'
import type { RecipeGenerationPort } from '#domain/recipe/interfaces/recipe-generation-port.interface'

let cachedRecipeGeneration: { adapter: RecipeGenerationPort; signature: AiProvider } | null = null
let testOverrideRecipeGeneration: RecipeGenerationPort | null = null

/** Test-only seam — same contract as `__setReceiptExtractionOverrideForTests`. */
export function __setRecipeGenerationOverrideForTests(port: RecipeGenerationPort | null): void {
  testOverrideRecipeGeneration = port
  cachedRecipeGeneration = null
}

function buildRecipeGenerationAdapter(provider: AiProvider): RecipeGenerationPort {
  switch (provider) {
    case 'gemini':
      return new GeminiRecipeGenerationAdapter(env.get('GEMINI_API_KEY', ''))
    case 'openai':
      return new OpenAiRecipeGenerationAdapter(env.get('OPENAI_API_KEY', ''))
    case 'ollama':
      return new OllamaRecipeGenerationAdapter(
        env.get('OLLAMA_BASE_URL', 'http://localhost:11434'),
        env.get('OLLAMA_TEXT_MODEL', ''),
      )
  }
}

/** Same hot-reload mechanism as `resolveReceiptExtractionAdapter`, separate cache. */
export async function resolveRecipeGenerationAdapter(
  settings: AiSettingsProvider,
): Promise<RecipeGenerationPort> {
  if (testOverrideRecipeGeneration) return testOverrideRecipeGeneration

  const effective = await settings.resolveEffective()
  if (!cachedRecipeGeneration || cachedRecipeGeneration.signature !== effective.activeProvider) {
    cachedRecipeGeneration = {
      adapter: buildRecipeGenerationAdapter(effective.activeProvider),
      signature: effective.activeProvider,
    }
  }
  return cachedRecipeGeneration.adapter
}
```

- [ ] **Step 4: Extend the registry test**

Append to `backend/tests/infrastructure/settings/ai-provider-registry.spec.ts` (add the two new imports at the top alongside the existing ones):

```ts
import { resolveRecipeGenerationAdapter } from '#infrastructure/settings/ai-provider-registry'
import { GeminiRecipeGenerationAdapter } from '#infrastructure/settings/gemini-recipe-generation.adapter'
import { OllamaRecipeGenerationAdapter } from '#infrastructure/settings/ollama-recipe-generation.adapter'
```

and a second `test.group`:

```ts
test.group('resolveRecipeGenerationAdapter (ai-provider-registry)', () => {
  test('returns the same adapter instance when the provider is unchanged', async ({ assert }) => {
    const settings = fakeSettings('gemini')
    const first = await resolveRecipeGenerationAdapter(settings)
    const second = await resolveRecipeGenerationAdapter(settings)
    assert.strictEqual(first, second)
    assert.instanceOf(first, GeminiRecipeGenerationAdapter)
  })

  test('rebuilds the adapter when the provider changes', async ({ assert }) => {
    await resolveRecipeGenerationAdapter(fakeSettings('gemini'))
    const afterSwitch = await resolveRecipeGenerationAdapter(fakeSettings('ollama'))
    assert.instanceOf(afterSwitch, OllamaRecipeGenerationAdapter)
  })
})
```

- [ ] **Step 5: Run the tests, typecheck, commit**

Run: `cd backend && rtk proxy task check`
Expected: PASS.

```bash
git add backend/src/infrastructure/settings backend/start/env.ts \
  backend/tests/infrastructure/settings/ai-provider-registry.spec.ts
git commit -m "feat(recipe): AI adapters (gemini/openai/ollama) + registry extension"
```

---

### Task 6: `recipe` persistence

**Files:**
- Create: `backend/src/infrastructure/database/recipe/recipe.lucid.ts`
- Create: `backend/src/infrastructure/database/recipe/recipe_ingredient.lucid.ts`
- Create: `backend/src/infrastructure/database/recipe/recipe.mapper.ts`
- Create: `backend/src/infrastructure/database/recipe/recipe.repository.ts`
- Test: `backend/tests/infrastructure/recipe/recipe.repository.spec.ts`

**Interfaces:**
- Consumes: `Recipe`/`RecipeIngredient`/`RecipeSource`/`RecipeRepository` (Task 4).
- Produces: `LucidRecipeRepository` — consumed by Task 7's `providers/recipe_provider.ts` binding.

- [ ] **Step 1: Lucid models**

`backend/src/infrastructure/database/recipe/recipe_ingredient.lucid.ts`:

```ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class RecipeIngredientModel extends BaseModel {
  static table = 'recipe_ingredient'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'recipe_id' })
  declare recipeId: string

  @column({ columnName: 'product_id' })
  declare productId: string | null

  @column()
  declare label: string

  @column()
  declare quantity: number | null

  @column()
  declare unit: string | null

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime
}
```

`backend/src/infrastructure/database/recipe/recipe.lucid.ts`:

```ts
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import RecipeIngredientModel from './recipe_ingredient.lucid.js'
import type { RecipeSourceValue } from '#domain/recipe/recipe-source.vo'

export default class RecipeModel extends BaseModel {
  static table = 'recipe'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare source: RecipeSourceValue

  @column()
  declare instructions: string

  @column({ columnName: 'preparation_time' })
  declare preparationTime: number | null

  @column()
  declare tags: string[]

  @column({ columnName: 'image_key' })
  declare imageKey: string | null

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @hasMany(() => RecipeIngredientModel, { foreignKey: 'recipeId' })
  declare ingredients: HasMany<typeof RecipeIngredientModel>
}
```

- [ ] **Step 2: Mapper**

`backend/src/infrastructure/database/recipe/recipe.mapper.ts`:

```ts
import { Recipe } from '#domain/recipe/recipe.aggregate'
import { RecipeIngredient } from '#domain/recipe/recipe-ingredient.entity'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'
import type RecipeModel from './recipe.lucid.js'

export function toDomain(row: RecipeModel): Recipe {
  const source = RecipeSource.create(row.source)
  if (!source.ok) throw new Error(`Corrupted recipe row ${row.id}: ${source.error.message}`)

  const ingredients = row.ingredients.map((i) =>
    RecipeIngredient.create(i.id, {
      recipeId: i.recipeId,
      productId: i.productId,
      label: i.label,
      quantity: i.quantity,
      unit: i.unit,
    }),
  )

  return Recipe.reconstruct(row.id, {
    householdId: row.householdId,
    title: row.title,
    description: row.description,
    source: source.value,
    instructions: row.instructions,
    preparationTime: row.preparationTime,
    tags: row.tags,
    imageKey: row.imageKey,
    ingredients,
    createdAt: row.createdAt.toJSDate(),
  })
}
```

- [ ] **Step 3: Write the failing repository test**

`backend/tests/infrastructure/recipe/recipe.repository.spec.ts`:

```ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidRecipeRepository } from '#infrastructure/database/recipe/recipe.repository'
import { Recipe } from '#domain/recipe/recipe.aggregate'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'

async function createUser(id: string, email: string) {
  await db.table('user').insert({
    id,
    name: email,
    email,
    email_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  })
}

async function createHousehold(id: string, ownerId: string) {
  await db.table('household').insert({
    id,
    name: 'Test household',
    owner_id: ownerId,
    invite_code: id.slice(0, 8).toUpperCase().padEnd(8, '0'),
    created_at: new Date(),
    updated_at: new Date(),
  })
}

function buildRecipe(id: string, householdId: string, ingredientCount = 1) {
  const source = RecipeSource.create('user')
  if (!source.ok) throw new Error('unreachable')

  return Recipe.create({
    id,
    householdId,
    title: 'Gratin de courgettes',
    source: source.value,
    instructions: 'Couper, cuire, gratiner.',
    ingredients: Array.from({ length: ingredientCount }, (_, i) => ({
      id: `${id}-ing-${i}`,
      label: `Ingrédient ${i}`,
      quantity: 1,
      unit: 'piece',
    })),
    createdAt: new Date(),
  })
}

test.group('LucidRecipeRepository', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('save() then findById() round-trips a recipe with its ingredients', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')

    const repository = new LucidRecipeRepository()
    await repository.save(buildRecipe('rc_1', 'h_1', 2))

    const found = await repository.findById('rc_1')
    assert.equal(found?.title, 'Gratin de courgettes')
    assert.lengthOf(found?.ingredients ?? [], 2)
  })

  test('findByHousehold() scopes to the household', async ({ assert }) => {
    await createUser('u_2', 'owner2@example.com')
    await createHousehold('h_2', 'u_2')
    await createUser('u_3', 'owner3@example.com')
    await createHousehold('h_3', 'u_3')

    const repository = new LucidRecipeRepository()
    await repository.save(buildRecipe('rc_2', 'h_2'))
    await repository.save(buildRecipe('rc_3', 'h_3'))

    const recipes = await repository.findByHousehold('h_2')
    assert.lengthOf(recipes, 1)
    assert.equal(recipes[0]?.id, 'rc_2')
  })

  test('save() removes ingredient rows no longer present on the aggregate', async ({ assert }) => {
    await createUser('u_4', 'owner4@example.com')
    await createHousehold('h_4', 'u_4')

    const repository = new LucidRecipeRepository()
    await repository.save(buildRecipe('rc_4', 'h_4', 3))
    await repository.save(buildRecipe('rc_4', 'h_4', 1))

    const found = await repository.findById('rc_4')
    assert.lengthOf(found?.ingredients ?? [], 1)
  })

  test('delete() removes the recipe and cascades its ingredients', async ({ assert }) => {
    await createUser('u_5', 'owner5@example.com')
    await createHousehold('h_5', 'u_5')

    const repository = new LucidRecipeRepository()
    await repository.save(buildRecipe('rc_5', 'h_5'))
    await repository.delete('rc_5')

    assert.isNull(await repository.findById('rc_5'))
  })
})
```

Run: `cd backend && rtk proxy pnpm exec node ace test unit --files "tests/infrastructure/recipe/**"`
Expected: FAIL — repository module not found.

- [ ] **Step 4: Repository**

`backend/src/infrastructure/database/recipe/recipe.repository.ts`:

```ts
import db from '@adonisjs/lucid/services/db'
import RecipeModel from './recipe.lucid.js'
import RecipeIngredientModel from './recipe_ingredient.lucid.js'
import { toDomain } from './recipe.mapper.js'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { Recipe } from '#domain/recipe/recipe.aggregate'

/**
 * Persists the aggregate + its internal `RecipeIngredient` entities in one
 * transaction, diffing removed ingredient rows — same pattern as
 * `LucidHouseholdRepository.save()` for `Household`/`HouseholdMember`.
 */
export class LucidRecipeRepository implements RecipeRepository {
  async findById(id: string): Promise<Recipe | null> {
    const row = await RecipeModel.query().where('id', id).preload('ingredients').first()
    return row ? toDomain(row) : null
  }

  async findByHousehold(householdId: string): Promise<Recipe[]> {
    const rows = await RecipeModel.query()
      .where('household_id', householdId)
      .preload('ingredients')
      .orderBy('created_at', 'desc')
    return rows.map(toDomain)
  }

  async save(recipe: Recipe): Promise<void> {
    await db.transaction(async (trx) => {
      await RecipeModel.updateOrCreate(
        { id: recipe.id },
        {
          householdId: recipe.householdId,
          title: recipe.title,
          description: recipe.description,
          source: recipe.source.value,
          instructions: recipe.instructions,
          preparationTime: recipe.preparationTime,
          tags: recipe.tags,
          imageKey: recipe.imageKey,
        },
        { client: trx },
      )

      const existingRows = await RecipeIngredientModel.query({ client: trx }).where(
        'recipe_id',
        recipe.id,
      )
      const currentIds = new Set(recipe.ingredients.map((i) => i.id))

      const removedIds = existingRows.filter((row) => !currentIds.has(row.id)).map((row) => row.id)
      if (removedIds.length > 0) {
        await RecipeIngredientModel.query({ client: trx }).whereIn('id', removedIds).delete()
      }

      for (const ingredient of recipe.ingredients) {
        await RecipeIngredientModel.updateOrCreate(
          { id: ingredient.id },
          {
            recipeId: ingredient.recipeId,
            productId: ingredient.productId,
            label: ingredient.label,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          },
          { client: trx },
        )
      }
    })
  }

  async delete(id: string): Promise<void> {
    await RecipeModel.query().where('id', id).delete()
  }
}
```

- [ ] **Step 5: Run the tests, typecheck, commit**

Run: `cd backend && rtk proxy task check`
Expected: PASS.

```bash
git add backend/src/infrastructure/database/recipe backend/tests/infrastructure/recipe
git commit -m "feat(recipe): persistence (LucidRecipeRepository, transactional save)"
```

---

### Task 7: `recipe` use-cases, presentation, wiring

**Files:**
- Create: `backend/src/application/recipe/generate-recipes.use-case.ts`
- Create: `backend/src/application/recipe/suggest-recipes.use-case.ts`
- Create: `backend/src/application/recipe/save-recipe.use-case.ts`
- Create: `backend/src/application/recipe/list-recipes.use-case.ts`
- Create: `backend/src/application/recipe/show-recipe.use-case.ts`
- Create: `backend/src/application/recipe/delete-recipe.use-case.ts`
- Create: `backend/src/presentation/recipe/recipe.dto.ts`
- Create: `backend/src/presentation/recipe/recipe.validator.ts`
- Create: `backend/src/presentation/recipe/recipe.controller.ts`
- Create: `backend/src/presentation/recipe/recipe.routes.ts`
- Create: `backend/providers/recipe_provider.ts`
- Modify: `backend/providers/settings_provider.ts` (add `settings.resolveRecipeGenerationPort` binding)
- Modify: `backend/adonisrc.ts` (register `recipe_provider`)
- Modify: `backend/start/routes.ts` (import `recipe.routes`)
- Modify: `backend/src/presentation/shared/error-serializer.ts` (add `recipe_not_found`, `generation_failed`)
- Test: `backend/tests/functional/recipe/recipe.spec.ts`

**Interfaces:**
- Consumes: `Recipe`/`RecipeSource`/`RecipeRepository`/`RecipeGenerationPort`/`RecipeDraft` (Task 4), `LucidRecipeRepository` (Task 6), `resolveRecipeGenerationAdapter`/`__setRecipeGenerationOverrideForTests` (Task 5), `ProductRepository` (existing `fridge.products` binding).
- Produces: container binding `recipe.recipes: RecipeRepository`, `settings.resolveRecipeGenerationPort: () => Promise<RecipeGenerationPort>`; routes `GET/POST /api/recipes`, `POST /api/recipes/generate`, `GET /api/recipes/suggestions`, `GET/DELETE /api/recipes/:id`.

- [ ] **Step 1: Use-cases**

`backend/src/application/recipe/generate-recipes.use-case.ts`:

```ts
import type { UseCase } from '#application/shared/use-case'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { RecipeGenerationPort } from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Recipe } from '#domain/recipe/recipe.aggregate'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'
import {
  RecipeGenerationUnavailableError,
  RecipeGenerationParseError,
} from '#domain/recipe/recipe-generation.errors'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface GenerateRecipesInput {
  householdId: string
  prompt?: string
}

export type GenerateRecipesError = 'provider_not_configured' | 'generation_failed'

/**
 * Persists every generated draft immediately (unlike `SuggestRecipes`,
 * which never persists) — matches `POST /api/recipes/generate`'s contract
 * in docs/phase-0/04-endpoints-http.md.
 */
export class GenerateRecipes
  implements UseCase<GenerateRecipesInput, ResultType<Recipe[], GenerateRecipesError>>
{
  constructor(
    private readonly recipes: RecipeRepository,
    private readonly products: ProductRepository,
    private readonly generation: RecipeGenerationPort,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: GenerateRecipesInput,
  ): Promise<ResultType<Recipe[], GenerateRecipesError>> {
    const householdProducts = await this.products.findByHousehold(input.householdId)

    let drafts
    try {
      drafts = await this.generation.generate({
        products: householdProducts.map((p) => ({
          name: p.name,
          category: p.category,
          expiresAt: p.expiresAt,
        })),
        prompt: input.prompt,
        prioritizeExpiringSoon: false,
      })
    } catch (error) {
      if (error instanceof RecipeGenerationUnavailableError)
        return Result.err('provider_not_configured')
      if (error instanceof RecipeGenerationParseError) return Result.err('generation_failed')
      throw error
    }

    const source = RecipeSource.create('ai')
    if (!source.ok) throw new Error('unreachable: "ai" is always a valid RecipeSource')

    const now = this.clock.now()
    const recipes = drafts.map((draft) =>
      Recipe.create({
        id: this.idGenerator.next(),
        householdId: input.householdId,
        title: draft.title,
        description: draft.description,
        source: source.value,
        instructions: draft.instructions,
        preparationTime: draft.preparationTime,
        tags: draft.tags,
        ingredients: draft.ingredients.map((i) => ({
          id: this.idGenerator.next(),
          productId: i.productId,
          label: i.label,
          quantity: i.quantity,
          unit: i.unit,
        })),
        createdAt: now,
      }),
    )

    for (const recipe of recipes) {
      await this.recipes.save(recipe)
    }

    return Result.ok(recipes)
  }
}
```

`backend/src/application/recipe/suggest-recipes.use-case.ts`:

```ts
import type { UseCase } from '#application/shared/use-case'
import type { RecipeGenerationPort } from '#domain/recipe/interfaces/recipe-generation-port.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'
import {
  RecipeGenerationUnavailableError,
  RecipeGenerationParseError,
} from '#domain/recipe/recipe-generation.errors'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface SuggestRecipesInput {
  householdId: string
}

export type SuggestRecipesError = 'provider_not_configured' | 'generation_failed'

/** Never persists — `POST /api/recipes` (SaveRecipe) is how a suggestion gets kept. */
export class SuggestRecipes
  implements UseCase<SuggestRecipesInput, ResultType<RecipeDraft[], SuggestRecipesError>>
{
  constructor(
    private readonly products: ProductRepository,
    private readonly generation: RecipeGenerationPort,
  ) {}

  async execute(
    input: SuggestRecipesInput,
  ): Promise<ResultType<RecipeDraft[], SuggestRecipesError>> {
    const householdProducts = await this.products.findByHousehold(input.householdId)

    try {
      const drafts = await this.generation.generate({
        products: householdProducts.map((p) => ({
          name: p.name,
          category: p.category,
          expiresAt: p.expiresAt,
        })),
        prioritizeExpiringSoon: true,
      })
      return Result.ok(drafts)
    } catch (error) {
      if (error instanceof RecipeGenerationUnavailableError)
        return Result.err('provider_not_configured')
      if (error instanceof RecipeGenerationParseError) return Result.err('generation_failed')
      throw error
    }
  }
}
```

`backend/src/application/recipe/save-recipe.use-case.ts`:

```ts
import type { UseCase } from '#application/shared/use-case'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Recipe } from '#domain/recipe/recipe.aggregate'
import { RecipeSource } from '#domain/recipe/recipe-source.vo'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface SaveRecipeIngredientInput {
  label: string
  productId?: string | null
  quantity?: number | null
  unit?: string | null
}

export interface SaveRecipeInput {
  householdId: string
  title: string
  source: string
  instructions: string
  ingredients: SaveRecipeIngredientInput[]
  description?: string | null
  preparationTime?: number | null
  tags?: string[]
}

export class SaveRecipe implements UseCase<SaveRecipeInput, ResultType<Recipe, ValidationError>> {
  constructor(
    private readonly recipes: RecipeRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: SaveRecipeInput): Promise<ResultType<Recipe, ValidationError>> {
    const source = RecipeSource.create(input.source)
    if (!source.ok) return source

    const recipe = Recipe.create({
      id: this.idGenerator.next(),
      householdId: input.householdId,
      title: input.title,
      source: source.value,
      instructions: input.instructions,
      description: input.description ?? null,
      preparationTime: input.preparationTime ?? null,
      tags: input.tags ?? [],
      ingredients: input.ingredients.map((i) => ({
        id: this.idGenerator.next(),
        productId: i.productId ?? null,
        label: i.label,
        // `recipe_ingredient.quantity` is an INTEGER column (docs/phase-0/03)
        // — round client-supplied values the same way the AI parser does
        // (Task 4), rather than letting a fractional value reach the DB as
        // an unhandled type error.
        quantity: i.quantity != null ? Math.round(i.quantity) : null,
        unit: i.unit ?? null,
      })),
      createdAt: this.clock.now(),
    })

    await this.recipes.save(recipe)
    return Result.ok(recipe)
  }
}
```

`backend/src/application/recipe/list-recipes.use-case.ts`:

```ts
import type { UseCase } from '#application/shared/use-case'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { Recipe } from '#domain/recipe/recipe.aggregate'

export interface ListRecipesInput {
  householdId: string
}

export class ListRecipes implements UseCase<ListRecipesInput, Recipe[]> {
  constructor(private readonly recipes: RecipeRepository) {}

  async execute(input: ListRecipesInput): Promise<Recipe[]> {
    return this.recipes.findByHousehold(input.householdId)
  }
}
```

`backend/src/application/recipe/show-recipe.use-case.ts`:

```ts
import type { UseCase } from '#application/shared/use-case'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import type { Recipe } from '#domain/recipe/recipe.aggregate'

export interface ShowRecipeInput {
  householdId: string
  recipeId: string
}

export class ShowRecipe implements UseCase<ShowRecipeInput, Recipe | null> {
  constructor(private readonly recipes: RecipeRepository) {}

  async execute(input: ShowRecipeInput): Promise<Recipe | null> {
    const recipe = await this.recipes.findById(input.recipeId)
    if (!recipe || recipe.householdId !== input.householdId) return null
    return recipe
  }
}
```

`backend/src/application/recipe/delete-recipe.use-case.ts`:

```ts
import type { UseCase } from '#application/shared/use-case'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface DeleteRecipeInput {
  householdId: string
  recipeId: string
}

export type DeleteRecipeError = 'recipe_not_found'

export class DeleteRecipe
  implements UseCase<DeleteRecipeInput, ResultType<void, DeleteRecipeError>>
{
  constructor(private readonly recipes: RecipeRepository) {}

  async execute(input: DeleteRecipeInput): Promise<ResultType<void, DeleteRecipeError>> {
    const recipe = await this.recipes.findById(input.recipeId)
    if (!recipe || recipe.householdId !== input.householdId) return Result.err('recipe_not_found')
    await this.recipes.delete(recipe.id)
    return Result.ok(undefined)
  }
}
```

- [ ] **Step 2: DTO, validator, controller, routes**

`backend/src/presentation/recipe/recipe.dto.ts`:

```ts
import type { Recipe } from '#domain/recipe/recipe.aggregate'
import type { RecipeDraft } from '#domain/recipe/recipe-draft'

export interface RecipeIngredientDto {
  id: string
  productId: string | null
  label: string
  quantity: number | null
  unit: string | null
}

export interface RecipeDto {
  id: string
  title: string
  description: string | null
  source: string
  instructions: string
  preparationTime: number | null
  tags: string[]
  imageKey: string | null
  ingredients: RecipeIngredientDto[]
  createdAt: string
}

export interface RecipeDraftDto {
  title: string
  description: string | null
  instructions: string
  preparationTime: number | null
  tags: string[]
  ingredients: {
    label: string
    productId: string | null
    quantity: number | null
    unit: string | null
  }[]
}

export function toRecipeDto(recipe: Recipe): RecipeDto {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    source: recipe.source.value,
    instructions: recipe.instructions,
    preparationTime: recipe.preparationTime,
    tags: recipe.tags,
    imageKey: recipe.imageKey,
    ingredients: recipe.ingredients.map((i) => ({
      id: i.id,
      productId: i.productId,
      label: i.label,
      quantity: i.quantity,
      unit: i.unit,
    })),
    createdAt: recipe.createdAt.toISOString(),
  }
}

export function toRecipeDraftDto(draft: RecipeDraft): RecipeDraftDto {
  return {
    title: draft.title,
    description: draft.description,
    instructions: draft.instructions,
    preparationTime: draft.preparationTime,
    tags: draft.tags,
    ingredients: draft.ingredients,
  }
}
```

`backend/src/presentation/recipe/recipe.validator.ts`:

```ts
import vine from '@vinejs/vine'

const recipeSourceSchema = vine.enum(['ai', 'user'] as const)
const ingredientSchema = vine.object({
  label: vine.string().trim().minLength(1),
  productId: vine.string().trim().optional().nullable(),
  quantity: vine.number().optional().nullable(),
  unit: vine.string().trim().optional().nullable(),
})

export const generateRecipesValidator = vine.compile(
  vine.object({
    prompt: vine.string().trim().maxLength(500).optional(),
  }),
)

export const saveRecipeValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(120),
    source: recipeSourceSchema,
    instructions: vine.string().trim().minLength(1),
    description: vine.string().trim().optional().nullable(),
    preparationTime: vine.number().positive().optional().nullable(),
    tags: vine.array(vine.string().trim()).optional(),
    ingredients: vine.array(ingredientSchema).minLength(1),
  }),
)
```

`backend/src/presentation/recipe/recipe.controller.ts`:

```ts
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { generateRecipesValidator, saveRecipeValidator } from './recipe.validator.js'
import { toRecipeDto, toRecipeDraftDto } from './recipe.dto.js'
import { GenerateRecipes } from '#application/recipe/generate-recipes.use-case'
import { SuggestRecipes } from '#application/recipe/suggest-recipes.use-case'
import { SaveRecipe } from '#application/recipe/save-recipe.use-case'
import { ListRecipes } from '#application/recipe/list-recipes.use-case'
import { ShowRecipe } from '#application/recipe/show-recipe.use-case'
import { DeleteRecipe } from '#application/recipe/delete-recipe.use-case'

export default class RecipeController {
  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const recipes = await ctx.containerResolver.make('recipe.recipes')
    const result = await new ListRecipes(recipes).execute({ householdId: ctx.household.id })
    return ctx.response.json({ recipes: result.map(toRecipeDto) })
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const recipes = await ctx.containerResolver.make('recipe.recipes')
    const recipe = await new ShowRecipe(recipes).execute({
      householdId: ctx.household.id,
      recipeId: ctx.params.id,
    })
    if (!recipe) {
      const { status, body } = serializeError('recipe_not_found')
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ recipe: toRecipeDto(recipe) })
  }

  async generate(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
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
    ).execute({ householdId: ctx.household.id, prompt })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(201).json({ recipes: result.value.map(toRecipeDto) })
  }

  async suggestions(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ recipes: result.value.map(toRecipeDraftDto) })
  }

  async store(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const payload = await ctx.request.validateUsing(saveRecipeValidator)
    const recipes = await ctx.containerResolver.make('recipe.recipes')
    const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
    const clock = await ctx.containerResolver.make('shared.clock')

    const result = await new SaveRecipe(recipes, idGenerator, clock).execute({
      householdId: ctx.household.id,
      ...payload,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(201).json({ recipe: toRecipeDto(result.value) })
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const recipes = await ctx.containerResolver.make('recipe.recipes')
    const result = await new DeleteRecipe(recipes).execute({
      householdId: ctx.household.id,
      recipeId: ctx.params.id,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(204).send('')
  }
}
```

`backend/src/presentation/recipe/recipe.routes.ts`:

```ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const RecipeController = () => import('./recipe.controller.js')

/**
 * `generate`/`suggestions` registered ahead of `:id` — same route-ordering
 * lesson as `product.routes.ts` (expiring-soon/lookup vs :id).
 */
router
  .group(() => {
    router.get('/recipes', [RecipeController, 'index'])
    router.post('/recipes', [RecipeController, 'store'])
    router.post('/recipes/generate', [RecipeController, 'generate'])
    router.get('/recipes/suggestions', [RecipeController, 'suggestions'])
    router.get('/recipes/:id', [RecipeController, 'show'])
    router.delete('/recipes/:id', [RecipeController, 'destroy'])
  })
  .prefix('/api')
  .use([middleware.householdRequired()])
```

- [ ] **Step 3: Provider, `settings_provider.ts` extension, `adonisrc.ts`, `start/routes.ts`, error-serializer**

`backend/providers/recipe_provider.ts`:

```ts
import type { ApplicationService } from '@adonisjs/core/types'
import type { RecipeRepository } from '#domain/recipe/interfaces/recipe-repository.interface'

export default class RecipeProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('recipe.recipes', async () => {
      const { LucidRecipeRepository } = await import(
        '#infrastructure/database/recipe/recipe.repository'
      )
      return new LucidRecipeRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'recipe.recipes': RecipeRepository
  }
}
```

In `backend/providers/settings_provider.ts`, add after the existing `settings.resolveReceiptExtractionPort` binding, inside `register()`:

```ts
    this.app.container.singleton('settings.resolveRecipeGenerationPort', async () => {
      const { resolveRecipeGenerationAdapter } =
        await import('#infrastructure/settings/ai-provider-registry')
      const aiSettingsProvider = await this.app.container.make('settings.aiSettingsProvider')
      return () => resolveRecipeGenerationAdapter(aiSettingsProvider)
    })
```

and to its `ContainerBindings` declaration, add the import at the top of the file:

```ts
import type { RecipeGenerationPort } from '#domain/recipe/interfaces/recipe-generation-port.interface'
```

and the binding entry:

```ts
    'settings.resolveRecipeGenerationPort': () => Promise<RecipeGenerationPort>
```

In `backend/adonisrc.ts`, add to `providers` after `#providers/shopping_list_provider` (Task 3):

```ts
    () => import('#providers/recipe_provider'),
```

In `backend/start/routes.ts`, add:

```ts
import '#presentation/recipe/recipe.routes'
```

In `backend/src/presentation/shared/error-serializer.ts`, add to `STRING_ERROR_STATUS`:

```ts
  recipe_not_found: 404,
  generation_failed: 422,
```

and to `STRING_ERROR_MESSAGES`:

```ts
  recipe_not_found: 'Recette introuvable.',
  generation_failed: "La génération de recette a échoué — réessayez, ou reformulez votre demande.",
```

- [ ] **Step 4: Functional test**

`backend/tests/functional/recipe/recipe.spec.ts`:

```ts
import { test } from '@japa/runner'
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
```

- [ ] **Step 5: Run the full suite, boundaries, commit**

Run: `cd backend && rtk proxy task check`
Expected: PASS — lint, typecheck, all tests, boundaries clean.

```bash
git add backend/src/application/recipe backend/src/presentation/recipe \
  backend/providers/recipe_provider.ts backend/providers/settings_provider.ts \
  backend/adonisrc.ts backend/start/routes.ts backend/src/presentation/shared/error-serializer.ts \
  backend/tests/functional/recipe
git commit -m "feat(recipe): use-cases, HTTP endpoints, AI generation wiring"
```

---

### Task 8: Bruno collection

**Files:**
- Create: `backend/bruno/shopping-list/list-shopping-items.bru`
- Create: `backend/bruno/shopping-list/create-shopping-item.bru`
- Create: `backend/bruno/shopping-list/update-shopping-item.bru`
- Create: `backend/bruno/shopping-list/delete-shopping-item.bru`
- Create: `backend/bruno/recipe/list-recipes.bru`
- Create: `backend/bruno/recipe/get-recipe.bru`
- Create: `backend/bruno/recipe/generate-recipes.bru`
- Create: `backend/bruno/recipe/recipe-suggestions.bru`
- Create: `backend/bruno/recipe/save-recipe.bru`
- Create: `backend/bruno/recipe/delete-recipe.bru`
- Modify: `backend/bruno/README.md`

**Interfaces:**
- Consumes: `{{baseUrl}}`, `{{cookie}}` collection variables (already defined in `backend/bruno/environments/local.bru`).
- Produces: `{{itemId}}` (from create-shopping-item), `{{recipeId}}` (from generate-recipes and save-recipe) collection variables for the requests that follow them.

- [ ] **Step 1: `shopping-list/` requests**

`backend/bruno/shopping-list/list-shopping-items.bru`:

```
meta {
  name: List shopping items
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/api/shopping-items
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}
```

`backend/bruno/shopping-list/create-shopping-item.bru`:

```
meta {
  name: Create shopping item
  type: http
  seq: 2
}

post {
  url: {{baseUrl}}/api/shopping-items
  body: json
  auth: none
}

headers {
  Cookie: {{cookie}}
}

body:json {
  {
    "name": "Farine",
    "quantity": { "amount": 1, "unit": "kg" },
    "source": "manual"
  }
}

script:post-response {
  const body = res.getBody();
  if (body && body.item && body.item.id) {
    bru.setVar("itemId", body.item.id);
  }
}
```

`backend/bruno/shopping-list/update-shopping-item.bru`:

```
meta {
  name: Toggle shopping item
  type: http
  seq: 3
}

patch {
  url: {{baseUrl}}/api/shopping-items/{{itemId}}
  body: json
  auth: none
}

headers {
  Cookie: {{cookie}}
}

body:json {
  {
    "checked": true
  }
}
```

`backend/bruno/shopping-list/delete-shopping-item.bru`:

```
meta {
  name: Delete shopping item
  type: http
  seq: 4
}

delete {
  url: {{baseUrl}}/api/shopping-items/{{itemId}}
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}
```

- [ ] **Step 2: `recipe/` requests**

`backend/bruno/recipe/list-recipes.bru`:

```
meta {
  name: List recipes
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/api/recipes
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}
```

`backend/bruno/recipe/get-recipe.bru`:

```
meta {
  name: Get recipe
  type: http
  seq: 2
}

get {
  url: {{baseUrl}}/api/recipes/{{recipeId}}
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}
```

`backend/bruno/recipe/generate-recipes.bru`:

```
meta {
  name: Generate recipes
  type: http
  seq: 3
}

post {
  url: {{baseUrl}}/api/recipes/generate
  body: json
  auth: none
}

headers {
  Cookie: {{cookie}}
}

body:json {
  {
    "prompt": "quelque chose de rapide pour ce soir"
  }
}

script:post-response {
  const body = res.getBody();
  if (body && body.recipes && body.recipes[0] && body.recipes[0].id) {
    bru.setVar("recipeId", body.recipes[0].id);
  }
}

docs {
  Needs a real AI provider configured (see settings/Set active AI provider) —
  same prerequisite as receipt/Scan receipt.
}
```

`backend/bruno/recipe/recipe-suggestions.bru`:

```
meta {
  name: Recipe suggestions
  type: http
  seq: 4
}

get {
  url: {{baseUrl}}/api/recipes/suggestions
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}

docs {
  Same AI prerequisite as Generate recipes. Does not persist — nothing shows
  up in List recipes afterwards unless you Save recipe explicitly.
}
```

`backend/bruno/recipe/save-recipe.bru`:

```
meta {
  name: Save recipe
  type: http
  seq: 5
}

post {
  url: {{baseUrl}}/api/recipes
  body: json
  auth: none
}

headers {
  Cookie: {{cookie}}
}

body:json {
  {
    "title": "Salade de tomates",
    "source": "user",
    "instructions": "Couper les tomates, assaisonner.",
    "ingredients": [
      { "label": "Tomate", "quantity": 3, "unit": "piece" }
    ]
  }
}

script:post-response {
  const body = res.getBody();
  if (body && body.recipe && body.recipe.id) {
    bru.setVar("recipeId", body.recipe.id);
  }
}

docs {
  No AI prerequisite — works with zero external credentials, unlike
  Generate recipes/Recipe suggestions.
}
```

`backend/bruno/recipe/delete-recipe.bru`:

```
meta {
  name: Delete recipe
  type: http
  seq: 6
}

delete {
  url: {{baseUrl}}/api/recipes/{{recipeId}}
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}
```

- [ ] **Step 3: Update `backend/bruno/README.md`**

Replace the last line ("Covers Phase 2 (`fridge`, `receipt`, `settings`) on top of Phase 1 (`identity`, `household`). `recipe`/`shopping-list` remain a later phase.") with:

```markdown
15. **shopping-list/Create shopping item** captures `{{itemId}}`, used by
    **Toggle/Delete shopping item**.
16. **recipe/Generate recipes** and **recipe/Recipe suggestions** need a real
    AI provider configured (see step 10) — **recipe/Save recipe** works with
    zero external credentials and also captures `{{recipeId}}`, used by
    **Get/Delete recipe**.

Covers Phase 3 (`shopping-list`, `recipe`) on top of Phase 1 (`identity`,
`household`) and Phase 2 (`fridge`, `receipt`, `settings`) — the full MVP v1
scope from `docs/phase-0/00-overview-et-points-a-valider.md`.
```

- [ ] **Step 4: Commit**

```bash
git add backend/bruno/shopping-list backend/bruno/recipe backend/bruno/README.md
git commit -m "docs(bruno): shopping-list + recipe request collection"
```
