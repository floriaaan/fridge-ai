# Home Assistant shopping-list sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind one Home Assistant `todo.*` entity to a foyer's shopping list, syncing in the direction the foyer picks (push / pull / two-way), configured from a modal-presented mobile screen.

**Architecture:** New backend-only bounded context `home-assistant` (domain/application/infrastructure/presentation, scoped per household, mirroring the existing layered DDD structure). The backend calls Home Assistant directly — never the phone. A write-through `ShoppingListMirror` service pushes local writes best-effort; an explicit `SyncShoppingList` use case reconciles both ways on pull-to-refresh. Secrets (the long-lived token) are encrypted at rest with a dedicated key, not `APP_KEY`. Mobile gets a new modal route with two states (connect, then pick-a-list) reusing existing UI primitives (`Chip`, `FormCard`, `AuthField`, `ActionSheet`).

**Tech Stack:** AdonisJS 7 + Lucid + VineJS + Japa (backend), Expo Router 57 + Tamagui + React Query + Jest (mobile). No new dependencies on either side — Node's built-in `crypto` for AES-256-GCM, the platform `fetch` for the Home Assistant HTTP client.

**Spec:** `docs/superpowers/specs/2026-09-07-home-assistant-shopping-list-sync-design.md`

## Global Constraints

- All backend code in `src/` obeys the layered dependency-cruiser rules (`.dependency-cruiser.cjs`): `domain` depends on nothing; `application` depends only on `domain`; `infrastructure` depends on `domain`+`application`, never `presentation`; `presentation` depends on `domain`+`application`, never `infrastructure` directly (wiring to infra happens in `providers/`, outside `src/`).
- Every backend import uses the `#domain/*`, `#application/*`, `#infrastructure/*`, `#presentation/*`, `#providers/*`, `#start/*` subpath aliases (see `backend/package.json`'s `imports` map) — never a relative `../../` crossing a layer boundary, and always a same-directory `./file.js` extension (ESM, `.js` even though the source is `.ts`) matching every existing file in `src/`.
- Mobile imports likewise always carry the `.js` extension on relative paths (see any existing file under `mobile/src/`).
- A VO's constructor is private; a static `create(...)` returns the VO directly when creation cannot fail, or `Result<TheVO, ValidationError>` when it can (`domain/shared/value-object.ts`'s own doc comment).
- A use case implements `UseCase<Input, Output>` (`application/shared/use-case.ts`) — one `execute()`, and never swallows its own errors. `ShoppingListMirror` (Task 14) is explicitly not a use case for exactly those reasons and does not implement that interface.
- Owner-only mutations use the same check as `set-active-ai-provider.use-case.ts`: `households.findByUserId(userId)`, `household.ownerId !== userId` → `Result.err('not_owner')`.
- Household-scoped routes are declared with `.use([middleware.householdRequired()])` and read the current household off `ctx.household` (never re-derive it) — see `app/middleware/household_required_middleware.ts` and `presentation/shopping-list/shopping-item.routes.ts`.
- French user-facing strings throughout (error messages, mobile copy) — this codebase's UI language.
- Every domain/application file gets a Japa unit spec under `backend/tests/unit/...` mirroring its own path; every infrastructure file needing I/O gets a spec under `backend/tests/infrastructure/...`; new HTTP routes get a functional spec under `backend/tests/functional/...`. Mobile screens/components get a Jest spec beside them (`*.test.tsx`).
- Run `cd backend && pnpm run test` / `cd mobile && pnpm run test` after every task's Step "run the tests" — never trust a step without seeing its actual output.

## Two deliberate additions beyond the spec

The spec (design doc) leaves two implementation details unstated; both are settled here so no task is ambiguous:

1. **`todoEntityName` is stored on the aggregate**, not resolved live on every `GET`. Denormalized alongside `todoEntityId` (set together by `bindList`), because resolving the friendly name via a live Home Assistant call on every read would make the settings screen's "which list" row depend on Home Assistant being reachable — the opposite of what a read-only `GET` should require. Adds one migration column (`todo_entity_name`).
2. **A `token_required` error** joins the `SaveHomeAssistantConnection` error union, for the one case the spec's table doesn't name: the very first `PUT` (no stored link yet) with a blank token. `PUT` with a blank token normally means "keep the stored token" (spec §6) — that has nothing to fall back to on a first save.

Both are additive (new error code, new column) and change nothing about the seven decisions already locked in the spec.

---

## Task 1: Encryption at rest — port, AES-256-GCM implementation, env wiring

**Files:**
- Create: `backend/src/domain/shared/encryption.interface.ts`
- Create: `backend/src/infrastructure/shared/aes-gcm-encryption.ts`
- Test: `backend/tests/infrastructure/shared/aes-gcm-encryption.spec.ts`
- Modify: `backend/start/env.ts` (add `ENCRYPTION_KEY`)
- Modify: `backend/.env.example` (add `ENCRYPTION_KEY=`, commented, near `APP_KEY`)
- Modify: `.github/workflows/ci.yml` (add `ENCRYPTION_KEY` to the `check` job's `env:` block)
- Modify: `backend/providers/shared_provider.ts` (register `shared.encryption`)

**Interfaces:**
- Produces: `Encryption` port (`encrypt(plaintext: string): string`, `decrypt(ciphertext: string): string`, `decrypt` throws on a tampered/foreign-key ciphertext), `AesGcmEncryption` class, container binding `'shared.encryption'` resolving to an `Encryption`.

- [ ] **Step 1: Write the port**

```ts
// backend/src/domain/shared/encryption.interface.ts
export interface Encryption {
  encrypt(plaintext: string): string
  decrypt(ciphertext: string): string
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// backend/tests/infrastructure/shared/aes-gcm-encryption.spec.ts
import { test } from '@japa/runner'
import { AesGcmEncryption } from '#infrastructure/shared/aes-gcm-encryption'

const KEY = Buffer.from('ci-test-encryption-key-32-bytes!') // exactly 32 bytes

test.group('AesGcmEncryption', () => {
  test('round-trips a plaintext', ({ assert }) => {
    const encryption = new AesGcmEncryption(KEY)
    const ciphertext = encryption.encrypt('super-secret-token')
    assert.equal(encryption.decrypt(ciphertext), 'super-secret-token')
  })

  test('the same plaintext encrypts to two different ciphertexts (random IV)', ({ assert }) => {
    const encryption = new AesGcmEncryption(KEY)
    assert.notEqual(encryption.encrypt('same'), encryption.encrypt('same'))
  })

  test('decrypt() throws on a tampered ciphertext', ({ assert }) => {
    const encryption = new AesGcmEncryption(KEY)
    const ciphertext = encryption.encrypt('super-secret-token')
    const tampered = ciphertext.slice(0, -4) + 'AAAA'
    assert.throws(() => encryption.decrypt(tampered))
  })

  test('decrypt() throws on an unrecognized format', ({ assert }) => {
    const encryption = new AesGcmEncryption(KEY)
    assert.throws(() => encryption.decrypt('not-a-ciphertext'))
  })

  test('constructor throws on a key that is not 32 bytes', ({ assert }) => {
    assert.throws(() => new AesGcmEncryption(Buffer.from('too-short')))
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && node ace test --files tests/infrastructure/shared/aes-gcm-encryption.spec.ts`
Expected: FAIL — `#infrastructure/shared/aes-gcm-encryption` not found.

- [ ] **Step 4: Implement**

```ts
// backend/src/infrastructure/shared/aes-gcm-encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { Encryption } from '#domain/shared/encryption.interface'

const ALGORITHM = 'aes-256-gcm'
const VERSION = 'v1'

/**
 * Stored format: `v1.<iv b64>.<tag b64>.<ciphertext b64>`. The version
 * prefix lets a future algorithm change coexist with rows written under
 * this one, rather than guessing a row's format from its shape.
 */
export class AesGcmEncryption implements Encryption {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) {
      throw new Error('AesGcmEncryption requires a 32-byte key.')
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv(ALGORITHM, this.key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return [VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.')
  }

  decrypt(ciphertext: string): string {
    const [version, ivB64, tagB64, dataB64] = ciphertext.split('.')
    if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
      throw new Error('Unrecognized ciphertext format.')
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])
    return decrypted.toString('utf8')
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && node ace test --files tests/infrastructure/shared/aes-gcm-encryption.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Wire the env var**

In `backend/start/env.ts`, add near `APP_KEY`:

```ts
  // Secrets-at-rest encryption key (Home Assistant token, cf. docs/adr/0012)
  // — deliberately not APP_KEY, which also signs sessions/cookies. 32 bytes,
  // base64-encoded (`openssl rand -base64 32`).
  ENCRYPTION_KEY: Env.schema.secret(),
```

In `backend/.env.example`, right after the `APP_KEY=` line:

```
# Secrets-at-rest key (Home Assistant token) — cf. docs/adr/0012. 32 random
# bytes, base64: `openssl rand -base64 32`.
ENCRYPTION_KEY=
```

In `.github/workflows/ci.yml`, in the `check` job's `env:` block, right after `APP_KEY`:

```yaml
      ENCRYPTION_KEY: Y2ktdGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcyE=
```

(That's `Buffer.from('ci-test-encryption-key-32-bytes!').toString('base64')` — the same 32-byte string the unit test above uses, base64-encoded, so CI and this spec agree on what a "valid key" looks like without either hardcoding the other's format.)

- [ ] **Step 7: Register the container binding**

In `backend/providers/shared_provider.ts`, add to `register()`:

```ts
    this.app.container.singleton('shared.encryption', async () => {
      const { AesGcmEncryption } = await import('#infrastructure/shared/aes-gcm-encryption')
      const envModule = await import('#start/env')
      const key = Buffer.from(envModule.default.get('ENCRYPTION_KEY').release(), 'base64')
      return new AesGcmEncryption(key)
    })
```

and to the `declare module` block:

```ts
    'shared.encryption': Encryption
```

with `import type { Encryption } from '#domain/shared/encryption.interface'` added to the top imports.

- [ ] **Step 8: Typecheck and commit**

Run: `cd backend && pnpm run typecheck`
Expected: no errors.

```bash
git add backend/src/domain/shared/encryption.interface.ts backend/src/infrastructure/shared/aes-gcm-encryption.ts backend/tests/infrastructure/shared/aes-gcm-encryption.spec.ts backend/start/env.ts backend/.env.example backend/providers/shared_provider.ts .github/workflows/ci.yml
git commit -m "feat(backend): add a dedicated AES-256-GCM encryption port for secrets at rest"
```

---

## Task 2: `InstanceUrl` value object

**Files:**
- Create: `backend/src/domain/home-assistant/instance-url.vo.ts`
- Test: `backend/tests/unit/domain/home-assistant/instance-url.vo.spec.ts`

**Interfaces:**
- Consumes: `ValueObject<Props>` (`#domain/shared/value-object`), `Result`/`ValidationError` (`#domain/shared/result`, `#domain/shared/validation-error`).
- Produces: `InstanceUrl.create(raw: string): Result<InstanceUrl, ValidationError>`, `.value: string` getter (normalized, no trailing slash).

- [ ] **Step 1: Write the failing tests**

```ts
// backend/tests/unit/domain/home-assistant/instance-url.vo.spec.ts
import { test } from '@japa/runner'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'

test.group('InstanceUrl', () => {
  test('accepts a bare http URL and strips the trailing slash', ({ assert }) => {
    const result = InstanceUrl.create('http://homeassistant.local:8123/')
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value.value, 'http://homeassistant.local:8123')
  })

  test('accepts https', ({ assert }) => {
    const result = InstanceUrl.create('https://ha.example.com')
    assert.isTrue(result.ok)
  })

  test('rejects a non-URL string', ({ assert }) => {
    assert.isFalse(InstanceUrl.create('not a url').ok)
  })

  test('rejects a non-http(s) scheme', ({ assert }) => {
    assert.isFalse(InstanceUrl.create('ftp://homeassistant.local').ok)
  })

  test('rejects embedded credentials', ({ assert }) => {
    assert.isFalse(InstanceUrl.create('http://user:pass@homeassistant.local').ok)
  })

  test('rejects a fragment', ({ assert }) => {
    assert.isFalse(InstanceUrl.create('http://homeassistant.local#foo').ok)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && node ace test --files tests/unit/domain/home-assistant/instance-url.vo.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/domain/home-assistant/instance-url.vo.ts
import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

interface InstanceUrlProps {
  value: string
}

export class InstanceUrl extends ValueObject<InstanceUrlProps> {
  private constructor(props: InstanceUrlProps) {
    super(props)
  }

  static create(raw: string): Result<InstanceUrl, ValidationError> {
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      return Result.err({ field: 'instanceUrl', message: "Cette adresse n'est pas valide." })
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return Result.err({ field: 'instanceUrl', message: 'Seuls http et https sont acceptés.' })
    }
    if (parsed.username || parsed.password) {
      return Result.err({
        field: 'instanceUrl',
        message: "L'adresse ne doit pas contenir d'identifiants.",
      })
    }
    if (parsed.hash) {
      return Result.err({ field: 'instanceUrl', message: "L'adresse ne doit pas contenir de fragment." })
    }

    const normalized = parsed.origin + parsed.pathname.replace(/\/+$/, '') + parsed.search
    return Result.ok(new InstanceUrl({ value: normalized }))
  }

  get value(): string {
    return this.props.value
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && node ace test --files tests/unit/domain/home-assistant/instance-url.vo.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/home-assistant/instance-url.vo.ts backend/tests/unit/domain/home-assistant/instance-url.vo.spec.ts
git commit -m "feat(backend): add the InstanceUrl value object"
```

---

## Task 3: `SyncDirection` value object

**Files:**
- Create: `backend/src/domain/home-assistant/sync-direction.vo.ts`
- Test: `backend/tests/unit/domain/home-assistant/sync-direction.vo.spec.ts`

**Interfaces:**
- Produces: `SyncDirectionValue = 'push' | 'pull' | 'two_way'`, `SyncDirection.create(raw: string): Result<SyncDirection, ValidationError>`, `SyncDirection.twoWay(): SyncDirection` (infallible default), `.value: SyncDirectionValue` getter.

- [ ] **Step 1: Write the failing tests**

```ts
// backend/tests/unit/domain/home-assistant/sync-direction.vo.spec.ts
import { test } from '@japa/runner'
import { SyncDirection } from '#domain/home-assistant/sync-direction.vo'

test.group('SyncDirection', () => {
  test('accepts "push", "pull", "two_way"', ({ assert }) => {
    assert.isTrue(SyncDirection.create('push').ok)
    assert.isTrue(SyncDirection.create('pull').ok)
    assert.isTrue(SyncDirection.create('two_way').ok)
  })

  test('rejects an unknown direction', ({ assert }) => {
    assert.isFalse(SyncDirection.create('sideways').ok)
  })

  test('twoWay() is the default and never fails', ({ assert }) => {
    assert.equal(SyncDirection.twoWay().value, 'two_way')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && node ace test --files tests/unit/domain/home-assistant/sync-direction.vo.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/domain/home-assistant/sync-direction.vo.ts
import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export type SyncDirectionValue = 'push' | 'pull' | 'two_way'

const VALID_DIRECTIONS: readonly SyncDirectionValue[] = ['push', 'pull', 'two_way']

interface SyncDirectionProps {
  value: SyncDirectionValue
}

export class SyncDirection extends ValueObject<SyncDirectionProps> {
  private constructor(props: SyncDirectionProps) {
    super(props)
  }

  static create(raw: string): Result<SyncDirection, ValidationError> {
    if (!VALID_DIRECTIONS.includes(raw as SyncDirectionValue)) {
      return Result.err({
        field: 'direction',
        message: `"${raw}" n'est pas un sens de synchronisation valide.`,
      })
    }
    return Result.ok(new SyncDirection({ value: raw as SyncDirectionValue }))
  }

  /** The default for a newly-created link (design §1) — always valid, so no `Result`. */
  static twoWay(): SyncDirection {
    return new SyncDirection({ value: 'two_way' })
  }

  get value(): SyncDirectionValue {
    return this.props.value
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && node ace test --files tests/unit/domain/home-assistant/sync-direction.vo.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/home-assistant/sync-direction.vo.ts backend/tests/unit/domain/home-assistant/sync-direction.vo.spec.ts
git commit -m "feat(backend): add the SyncDirection value object"
```

---

## Task 4: `HomeAssistantLink` aggregate, read models, port interfaces

**Files:**
- Create: `backend/src/domain/home-assistant/link-unreadable.error.ts`
- Create: `backend/src/domain/home-assistant/home-assistant-error.ts`
- Create: `backend/src/domain/home-assistant/todo-entity.ts`
- Create: `backend/src/domain/home-assistant/todo-item.ts`
- Create: `backend/src/domain/home-assistant/home-assistant-link.aggregate.ts`
- Create: `backend/src/domain/home-assistant/interfaces/home-assistant-link-repository.interface.ts`
- Create: `backend/src/domain/home-assistant/interfaces/home-assistant-client.interface.ts`
- Create: `backend/src/domain/home-assistant/interfaces/host-policy.interface.ts`
- Test: `backend/tests/unit/domain/home-assistant/home-assistant-link.aggregate.spec.ts`

**Interfaces:**
- Consumes: `InstanceUrl` (Task 2), `SyncDirection` (Task 3), `AggregateRoot<Id>` (`#domain/shared/aggregate-root`).
- Produces: `HomeAssistantLink` (getters: `householdId`, `instanceUrl`, `token`, `todoEntityId`, `todoEntityName`, `direction`, `enabled`, `lastSyncAt`, `lastError`, `createdAt`, `updatedAt`; methods: `updateConnection`, `bindList`, `changeDirection`, `setEnabled`, `recordSync`, `recordFailure`), `HomeAssistantError` type, `TodoEntity`/`TodoItem` read models, `HomeAssistantLinkRepository`/`HomeAssistantClient`/`HomeAssistantConnection`/`HostPolicy` interfaces, `LinkUnreadableError` class — all consumed by Tasks 6–14.

`LinkUnreadableError` lives in `domain/`, not `infrastructure/`, specifically so `application/` use cases (Task 11) can catch it without an `application → infrastructure` import, which the boundary rule (`.dependency-cruiser.cjs`) forbids. A plain zero-dependency `Error` subclass is fine in `domain/` — the "domain has zero dependencies" rule blocks imports, not defining a class.

- [ ] **Step 1: Write the failing test for the aggregate's transitions**

```ts
// backend/tests/unit/domain/home-assistant/home-assistant-link.aggregate.spec.ts
import { test } from '@japa/runner'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { SyncDirection } from '#domain/home-assistant/sync-direction.vo'

function url(raw: string): InstanceUrl {
  const result = InstanceUrl.create(raw)
  if (!result.ok) throw new Error('bad fixture URL')
  return result.value
}

test.group('HomeAssistantLink', () => {
  test('create() defaults to two_way, enabled, no list bound', ({ assert }) => {
    const now = new Date('2026-09-01T00:00:00.000Z')
    const link = HomeAssistantLink.create({
      id: 'link-1',
      householdId: 'household-1',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'abc',
      createdAt: now,
    })
    assert.equal(link.direction.value, 'two_way')
    assert.isTrue(link.enabled)
    assert.isNull(link.todoEntityId)
    assert.isNull(link.todoEntityName)
    assert.isNull(link.lastSyncAt)
    assert.isNull(link.lastError)
  })

  test('bindList() sets both the id and the friendly name', ({ assert }) => {
    const link = HomeAssistantLink.create({
      id: 'link-1',
      householdId: 'household-1',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'abc',
      createdAt: new Date(),
    })
    link.bindList('todo.courses', 'Courses', new Date())
    assert.equal(link.todoEntityId, 'todo.courses')
    assert.equal(link.todoEntityName, 'Courses')
  })

  test('recordSync() clears a previous error', ({ assert }) => {
    const link = HomeAssistantLink.create({
      id: 'link-1',
      householdId: 'household-1',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'abc',
      createdAt: new Date(),
    })
    link.recordFailure('boom', new Date())
    assert.equal(link.lastError, 'boom')
    const syncedAt = new Date('2026-09-02T00:00:00.000Z')
    link.recordSync(syncedAt)
    assert.isNull(link.lastError)
    assert.equal(link.lastSyncAt, syncedAt)
  })

  test('recordFailure() truncates to 500 characters', ({ assert }) => {
    const link = HomeAssistantLink.create({
      id: 'link-1',
      householdId: 'household-1',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'abc',
      createdAt: new Date(),
    })
    link.recordFailure('x'.repeat(600), new Date())
    assert.equal(link.lastError?.length, 500)
  })

  test('changeDirection() and setEnabled() update independently', ({ assert }) => {
    const link = HomeAssistantLink.create({
      id: 'link-1',
      householdId: 'household-1',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'abc',
      createdAt: new Date(),
    })
    const push = SyncDirection.create('push')
    if (!push.ok) throw new Error('bad fixture direction')
    link.changeDirection(push.value, new Date())
    link.setEnabled(false, new Date())
    assert.equal(link.direction.value, 'push')
    assert.isFalse(link.enabled)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && node ace test --files tests/unit/domain/home-assistant/home-assistant-link.aggregate.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the small supporting files**

```ts
// backend/src/domain/home-assistant/link-unreadable.error.ts
/** Thrown by the mapper (Task 10) when a stored token fails to decrypt — a
 * changed or lost ENCRYPTION_KEY, or a corrupted row. Caught by the use
 * cases that read a link (Task 11) and turned into `Result.err('link_unreadable')`. */
export class LinkUnreadableError extends Error {
  constructor(linkId: string) {
    super(`Home Assistant link ${linkId} is unreadable (decryption failed).`)
    this.name = 'LinkUnreadableError'
  }
}
```

```ts
// backend/src/domain/home-assistant/home-assistant-error.ts
export type HomeAssistantError = 'unreachable' | 'unauthorized' | 'entity_not_found' | 'unexpected_response'
```

```ts
// backend/src/domain/home-assistant/todo-entity.ts
export interface TodoEntity {
  entityId: string
  friendlyName: string
}
```

```ts
// backend/src/domain/home-assistant/todo-item.ts
export interface TodoItem {
  uid: string
  summary: string
  description: string | null
  status: 'needs_action' | 'completed'
}
```

```ts
// backend/src/domain/home-assistant/interfaces/host-policy.interface.ts
import type { InstanceUrl } from '../instance-url.vo.js'

export interface HostPolicy {
  isAllowed(url: InstanceUrl): boolean
}
```

```ts
// backend/src/domain/home-assistant/interfaces/home-assistant-client.interface.ts
import type { Result } from '#domain/shared/result'
import type { TodoEntity } from '../todo-entity.js'
import type { TodoItem } from '../todo-item.js'
import type { HomeAssistantError } from '../home-assistant-error.js'

export interface HomeAssistantConnection {
  instanceUrl: string
  token: string
}

export interface HomeAssistantClient {
  ping(connection: HomeAssistantConnection): Promise<Result<void, HomeAssistantError>>
  listTodoEntities(connection: HomeAssistantConnection): Promise<Result<TodoEntity[], HomeAssistantError>>
  listItems(connection: HomeAssistantConnection, entityId: string): Promise<Result<TodoItem[], HomeAssistantError>>
  addItem(
    connection: HomeAssistantConnection,
    entityId: string,
    item: { summary: string; description: string },
  ): Promise<Result<void, HomeAssistantError>>
  updateItem(
    connection: HomeAssistantConnection,
    entityId: string,
    uid: string,
    patch: { summary?: string; description?: string; status?: 'needs_action' | 'completed' },
  ): Promise<Result<void, HomeAssistantError>>
  removeItem(
    connection: HomeAssistantConnection,
    entityId: string,
    uid: string,
  ): Promise<Result<void, HomeAssistantError>>
}
```

```ts
// backend/src/domain/home-assistant/interfaces/home-assistant-link-repository.interface.ts
import type { HomeAssistantLink } from '../home-assistant-link.aggregate.js'

export interface HomeAssistantLinkRepository {
  find(householdId: string): Promise<HomeAssistantLink | null>
  save(link: HomeAssistantLink): Promise<void>
  delete(householdId: string): Promise<void>
}
```

- [ ] **Step 4: Implement the aggregate**

```ts
// backend/src/domain/home-assistant/home-assistant-link.aggregate.ts
import { AggregateRoot } from '#domain/shared/aggregate-root'
import { SyncDirection } from './sync-direction.vo.js'
import type { InstanceUrl } from './instance-url.vo.js'

interface HomeAssistantLinkProps {
  householdId: string
  instanceUrl: InstanceUrl
  token: string
  todoEntityId: string | null
  todoEntityName: string | null
  direction: SyncDirection
  enabled: boolean
  lastSyncAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

/** One row per household (repository enforces uniqueness, cf. design §3 — same
 * convention as `AiProviderSettings`/`Household` not enforcing their own
 * singleton/one-per-user rule in the aggregate either). */
export class HomeAssistantLink extends AggregateRoot<string> {
  private props: HomeAssistantLinkProps

  private constructor(id: string, props: HomeAssistantLinkProps) {
    super(id)
    this.props = props
  }

  static create(params: {
    id: string
    householdId: string
    instanceUrl: InstanceUrl
    token: string
    createdAt: Date
  }): HomeAssistantLink {
    return new HomeAssistantLink(params.id, {
      householdId: params.householdId,
      instanceUrl: params.instanceUrl,
      token: params.token,
      todoEntityId: null,
      todoEntityName: null,
      direction: SyncDirection.twoWay(),
      enabled: true,
      lastSyncAt: null,
      lastError: null,
      createdAt: params.createdAt,
      updatedAt: params.createdAt,
    })
  }

  static reconstruct(id: string, props: HomeAssistantLinkProps): HomeAssistantLink {
    return new HomeAssistantLink(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }

  get instanceUrl(): InstanceUrl {
    return this.props.instanceUrl
  }

  get token(): string {
    return this.props.token
  }

  get todoEntityId(): string | null {
    return this.props.todoEntityId
  }

  get todoEntityName(): string | null {
    return this.props.todoEntityName
  }

  get direction(): SyncDirection {
    return this.props.direction
  }

  get enabled(): boolean {
    return this.props.enabled
  }

  get lastSyncAt(): Date | null {
    return this.props.lastSyncAt
  }

  get lastError(): string | null {
    return this.props.lastError
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  updateConnection(instanceUrl: InstanceUrl, token: string, now: Date): void {
    this.props = { ...this.props, instanceUrl, token, updatedAt: now }
  }

  bindList(todoEntityId: string, todoEntityName: string, now: Date): void {
    this.props = { ...this.props, todoEntityId, todoEntityName, updatedAt: now }
  }

  changeDirection(direction: SyncDirection, now: Date): void {
    this.props = { ...this.props, direction, updatedAt: now }
  }

  setEnabled(enabled: boolean, now: Date): void {
    this.props = { ...this.props, enabled, updatedAt: now }
  }

  recordSync(now: Date): void {
    this.props = { ...this.props, lastSyncAt: now, lastError: null, updatedAt: now }
  }

  recordFailure(message: string, now: Date): void {
    this.props = { ...this.props, lastError: message.slice(0, 500), updatedAt: now }
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && node ace test --files tests/unit/domain/home-assistant/home-assistant-link.aggregate.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Typecheck and boundary-lint**

Run: `cd backend && pnpm run typecheck && pnpm run boundaries`
Expected: no errors — confirms the new `domain/home-assistant/` files have zero outside dependencies.

- [ ] **Step 7: Commit**

```bash
git add backend/src/domain/home-assistant backend/tests/unit/domain/home-assistant/home-assistant-link.aggregate.spec.ts
git commit -m "feat(backend): add the HomeAssistantLink aggregate and home-assistant domain ports"
```

---

## Task 5: `ShoppingItem` entity — `haUid`/`haSyncedAt`, sync transitions

**Files:**
- Modify: `backend/src/domain/shopping-list/shopping-item.entity.ts`
- Modify: `backend/src/domain/shopping-list/interfaces/shopping-item-repository.interface.ts` (add `clearHomeAssistantSync`)
- Modify: `backend/tests/unit/domain/shopping-list/shopping-item.entity.spec.ts` (extend with the new behavior)

**Interfaces:**
- Produces: `ShoppingItem.haUid: string | null`, `.haSyncedAt: Date | null` getters; `markSynced(haUid: string | null, syncedAt: Date): void`; `adoptFromHomeAssistant(patch: { name: string; checked: boolean; quantity: Quantity }, haUid: string, syncedAt: Date): void`. Consumed by Task 13 (the reconcile) and Task 10 (the shopping-item mapper, modified alongside).
- The dirty rule the reconcile relies on: an item is dirty iff `item.haSyncedAt === null || item.updatedAt > item.haSyncedAt`.

- [ ] **Step 1: Read the current test file to extend it in place**

Run: `cd backend && cat tests/unit/domain/shopping-list/shopping-item.entity.spec.ts`

(Read whatever exists there — this step appends new `test()` blocks inside the existing `test.group(...)`, it does not replace the file.)

- [ ] **Step 2: Write the failing tests** (append inside the existing `test.group('ShoppingItem', ...)`)

```ts
  test('a new item has no Home Assistant uid and is unsynced', ({ assert }) => {
    const quantity = Quantity.create(1, 'pièce')
    const source = ShoppingItemSource.create('manual')
    if (!quantity.ok || !source.ok) throw new Error('bad fixtures')
    const item = ShoppingItem.create({
      id: 'item-1',
      householdId: 'household-1',
      name: 'Lait',
      quantity: quantity.value,
      source: source.value,
      createdAt: new Date(),
    })
    assert.isNull(item.haUid)
    assert.isNull(item.haSyncedAt)
  })

  test('markSynced() sets the uid and sync time without touching updatedAt', ({ assert }) => {
    const quantity = Quantity.create(1, 'pièce')
    const source = ShoppingItemSource.create('manual')
    if (!quantity.ok || !source.ok) throw new Error('bad fixtures')
    const createdAt = new Date('2026-09-01T00:00:00.000Z')
    const item = ShoppingItem.create({
      id: 'item-1',
      householdId: 'household-1',
      name: 'Lait',
      quantity: quantity.value,
      source: source.value,
      createdAt,
    })
    const syncedAt = new Date('2026-09-02T00:00:00.000Z')
    item.markSynced('ha-uid-1', syncedAt)
    assert.equal(item.haUid, 'ha-uid-1')
    assert.equal(item.haSyncedAt, syncedAt)
    assert.equal(item.updatedAt, createdAt)
  })

  test('markSynced(null, ...) clears a stale uid', ({ assert }) => {
    const quantity = Quantity.create(1, 'pièce')
    const source = ShoppingItemSource.create('manual')
    if (!quantity.ok || !source.ok) throw new Error('bad fixtures')
    const item = ShoppingItem.create({
      id: 'item-1',
      householdId: 'household-1',
      name: 'Lait',
      quantity: quantity.value,
      source: source.value,
      createdAt: new Date(),
    })
    item.markSynced('ha-uid-1', new Date())
    item.markSynced(null, new Date())
    assert.isNull(item.haUid)
  })

  test('adoptFromHomeAssistant() overwrites content and marks clean at the same instant', ({ assert }) => {
    const quantity = Quantity.create(1, 'pièce')
    const newQuantity = Quantity.create(2, 'L')
    const source = ShoppingItemSource.create('manual')
    if (!quantity.ok || !newQuantity.ok || !source.ok) throw new Error('bad fixtures')
    const item = ShoppingItem.create({
      id: 'item-1',
      householdId: 'household-1',
      name: 'Lait',
      quantity: quantity.value,
      source: source.value,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    const now = new Date('2026-09-03T00:00:00.000Z')
    item.adoptFromHomeAssistant({ name: 'Lait entier', checked: true, quantity: newQuantity.value }, 'ha-uid-2', now)
    assert.equal(item.name, 'Lait entier')
    assert.isTrue(item.checked)
    assert.equal(item.quantity.amount, 2)
    assert.equal(item.haUid, 'ha-uid-2')
    assert.equal(item.updatedAt, now)
    assert.equal(item.haSyncedAt, now)
  })

  test('a local edit after a sync makes the item dirty again (updatedAt > haSyncedAt)', ({ assert }) => {
    const quantity = Quantity.create(1, 'pièce')
    const source = ShoppingItemSource.create('manual')
    if (!quantity.ok || !source.ok) throw new Error('bad fixtures')
    const item = ShoppingItem.create({
      id: 'item-1',
      householdId: 'household-1',
      name: 'Lait',
      quantity: quantity.value,
      source: source.value,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    item.markSynced('ha-uid-1', new Date('2026-09-02T00:00:00.000Z'))
    item.update({ name: 'Lait demi-écrémé' }, new Date('2026-09-03T00:00:00.000Z'))
    assert.isTrue(item.updatedAt > (item.haSyncedAt as Date))
  })
```

(These tests need `import { Quantity } from '#domain/fridge/quantity.vo'` and `import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'` at the top of the spec file — add them if the existing file doesn't already import both.)

- [ ] **Step 3: Run to verify the new tests fail**

Run: `cd backend && node ace test --files tests/unit/domain/shopping-list/shopping-item.entity.spec.ts`
Expected: FAIL — `haUid`/`markSynced`/`adoptFromHomeAssistant` don't exist yet.

- [ ] **Step 4: Modify the entity**

```ts
// backend/src/domain/shopping-list/shopping-item.entity.ts
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
  haUid: string | null
  haSyncedAt: Date | null
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
      haUid: null,
      haSyncedAt: null,
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

  get haUid(): string | null {
    return this.props.haUid
  }

  get haSyncedAt(): Date | null {
    return this.props.haSyncedAt
  }

  update(patch: UpdateShoppingItemProps, updatedAt: Date): void {
    this.props = { ...this.props, ...patch, updatedAt }
  }

  toggle(updatedAt: Date): void {
    this.props = { ...this.props, checked: !this.props.checked, updatedAt }
  }

  /** Refreshes the Home Assistant sync bookmark without touching local content
   * or `updatedAt` — passing `null` explicitly clears a stale uid (the item
   * was re-added to Home Assistant and does not have a new one yet). */
  markSynced(haUid: string | null, syncedAt: Date): void {
    this.props = { ...this.props, haUid, haSyncedAt: syncedAt }
  }

  /** Overwrites local content from Home Assistant's state and marks the item
   * clean at the same instant — `updatedAt` and `haSyncedAt` both become
   * `syncedAt`, so the next reconcile's dirty check (`updatedAt > haSyncedAt`)
   * reads false. */
  adoptFromHomeAssistant(
    patch: { name: string; checked: boolean; quantity: Quantity },
    haUid: string,
    syncedAt: Date,
  ): void {
    this.props = {
      ...this.props,
      name: patch.name,
      checked: patch.checked,
      quantity: patch.quantity,
      haUid,
      haSyncedAt: syncedAt,
      updatedAt: syncedAt,
    }
  }
}
```

- [ ] **Step 5: Add the repository method used by unlink (Task 12)**

```ts
// backend/src/domain/shopping-list/interfaces/shopping-item-repository.interface.ts
import type { ShoppingItem } from '../shopping-item.entity.js'

export interface ShoppingItemRepository {
  findById(id: string): Promise<ShoppingItem | null>
  findByHousehold(householdId: string): Promise<ShoppingItem[]>
  save(item: ShoppingItem): Promise<void>
  delete(id: string): Promise<void>
  /** Resets `ha_uid`/`ha_synced_at` to null for every item in the household —
   * used by `UnlinkHomeAssistant` (Task 12) so a stale uid never survives a
   * "Délier" and gets mis-adopted if the foyer reconnects later. */
  clearHomeAssistantSync(householdId: string): Promise<void>
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd backend && node ace test --files tests/unit/domain/shopping-list/shopping-item.entity.spec.ts`
Expected: PASS, all tests including the 5 new ones.

Run: `cd backend && pnpm run typecheck`
Expected: FAILS at this point — `LucidShoppingItemRepository` (Task 6) doesn't implement `clearHomeAssistantSync` yet, and its mapper/model don't know `haUid`/`haSyncedAt`. That's expected; Task 6 closes it. Confirm the *only* errors are in `infrastructure/database/shopping-list/*` before moving on.

- [ ] **Step 7: Commit**

```bash
git add backend/src/domain/shopping-list/shopping-item.entity.ts backend/src/domain/shopping-list/interfaces/shopping-item-repository.interface.ts backend/tests/unit/domain/shopping-list/shopping-item.entity.spec.ts
git commit -m "feat(backend): give ShoppingItem a Home Assistant sync bookmark"
```

---

## Task 6: Migrations — `home_assistant_link` table, `shopping_item` HA columns

**Files:**
- Create: `backend/database/migrations/1785200000012_create_home_assistant_link_table.ts`
- Create: `backend/database/migrations/1785200000013_add_ha_columns_to_shopping_item_table.ts`

**Interfaces:**
- Produces: the `home_assistant_link` table (columns match `HomeAssistantLinkProps` from Task 4 plus `id`, `encrypted_token`, `todo_entity_name`) and `shopping_item.ha_uid`/`shopping_item.ha_synced_at`, consumed by the Lucid models in Task 10.

- [ ] **Step 1: Write the first migration**

```ts
// backend/database/migrations/1785200000012_create_home_assistant_link_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

/** Cf. docs/adr/0013. One row per household — uniqueness enforced by the
 * repository's upsert (`updateOrCreate` keyed by household_id lookup, cf.
 * ai_provider_setting's own note), same convention as that singleton table. */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('home_assistant_link', (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('instance_url').notNullable()
      table.text('encrypted_token').notNullable()
      table.text('todo_entity_id').nullable()
      table.text('todo_entity_name').nullable()
      table.text('direction').notNullable().defaultTo('two_way').checkIn(['push', 'pull', 'two_way'])
      table.boolean('enabled').notNullable().defaultTo(true)
      table.timestamp('last_sync_at', { useTz: true }).nullable()
      table.string('last_error', 500).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable('home_assistant_link')
  }
}
```

- [ ] **Step 2: Write the second migration**

```ts
// backend/database/migrations/1785200000013_add_ha_columns_to_shopping_item_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('shopping_item', (table) => {
      table.text('ha_uid').nullable()
      table.timestamp('ha_synced_at', { useTz: true }).nullable()
    })

    this.schema.alterTable('shopping_item', (table) => {
      table.index('ha_uid')
    })
  }

  async down() {
    this.schema.alterTable('shopping_item', (table) => {
      table.dropColumn('ha_uid')
      table.dropColumn('ha_synced_at')
    })
  }
}
```

- [ ] **Step 3: Run both migrations against the dev database**

Run: `cd .. && task dev:db` (starts Postgres if it isn't already running), then `cd backend && node ace migration:run`
Expected: both migrations listed as run, no error.

- [ ] **Step 4: Verify the rollback path**

Run: `cd backend && node ace migration:rollback && node ace migration:run`
Expected: both migrations roll back cleanly and re-apply cleanly — confirms `down()` is correct before it's relied on.

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/1785200000012_create_home_assistant_link_table.ts backend/database/migrations/1785200000013_add_ha_columns_to_shopping_item_table.ts
git commit -m "feat(backend): add migrations for home_assistant_link and shopping_item's HA columns"
```

---

## Task 7: `EnvHostPolicy` — the SSRF allowlist

**Files:**
- Create: `backend/src/infrastructure/home-assistant/env-host-policy.ts`
- Test: `backend/tests/infrastructure/home-assistant/env-host-policy.spec.ts`
- Modify: `backend/start/env.ts` (add `HOME_ASSISTANT_ALLOWED_HOSTS`)
- Modify: `backend/.env.example` (add it, commented, empty = allow all)

**Interfaces:**
- Consumes: `HostPolicy` (Task 4), `InstanceUrl` (Task 2).
- Produces: `EnvHostPolicy implements HostPolicy`, consumed by Task 11 (connection use cases) and Task 14 (mirror).

- [ ] **Step 1: Write the failing tests**

```ts
// backend/tests/infrastructure/home-assistant/env-host-policy.spec.ts
import { test } from '@japa/runner'
import env from '#start/env'
import { EnvHostPolicy } from '#infrastructure/home-assistant/env-host-policy'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'

function url(raw: string): InstanceUrl {
  const result = InstanceUrl.create(raw)
  if (!result.ok) throw new Error('bad fixture URL')
  return result.value
}

test.group('EnvHostPolicy', (group) => {
  const original = env.get('HOME_ASSISTANT_ALLOWED_HOSTS', '')
  group.each.teardown(() => process.env.HOME_ASSISTANT_ALLOWED_HOSTS = original)

  test('allows everything when the env var is unset', ({ assert }) => {
    delete process.env.HOME_ASSISTANT_ALLOWED_HOSTS
    const policy = new EnvHostPolicy()
    assert.isTrue(policy.isAllowed(url('http://192.168.1.50:8123')))
  })

  test('allows a bare hostname match', ({ assert }) => {
    process.env.HOME_ASSISTANT_ALLOWED_HOSTS = 'homeassistant.local'
    const policy = new EnvHostPolicy()
    assert.isTrue(policy.isAllowed(url('http://homeassistant.local:8123')))
  })

  test('allows a host:port match', ({ assert }) => {
    process.env.HOME_ASSISTANT_ALLOWED_HOSTS = 'homeassistant.local:8123'
    const policy = new EnvHostPolicy()
    assert.isTrue(policy.isAllowed(url('http://homeassistant.local:8123')))
  })

  test('rejects a host not on the list', ({ assert }) => {
    process.env.HOME_ASSISTANT_ALLOWED_HOSTS = 'homeassistant.local'
    const policy = new EnvHostPolicy()
    assert.isFalse(policy.isAllowed(url('http://evil.example.com')))
  })

  test('rejects a right host on the wrong explicit port', ({ assert }) => {
    process.env.HOME_ASSISTANT_ALLOWED_HOSTS = 'homeassistant.local:8123'
    const policy = new EnvHostPolicy()
    assert.isFalse(policy.isAllowed(url('http://homeassistant.local:9999')))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && node ace test --files tests/infrastructure/home-assistant/env-host-policy.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/infrastructure/home-assistant/env-host-policy.ts
import env from '#start/env'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { InstanceUrl } from '#domain/home-assistant/instance-url.vo'

/** Cf. design §7. Empty or unset = allow all, so existing deployments and
 * `task setup` need no new value. */
export class EnvHostPolicy implements HostPolicy {
  isAllowed(url: InstanceUrl): boolean {
    const raw = env.get('HOME_ASSISTANT_ALLOWED_HOSTS', '')
    if (!raw.trim()) return true

    const allowed = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)

    const parsed = new URL(url.value)
    const host = parsed.hostname
    const hostWithPort = parsed.port ? `${host}:${parsed.port}` : host

    return allowed.includes(host) || allowed.includes(hostWithPort)
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && node ace test --files tests/infrastructure/home-assistant/env-host-policy.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire the env var**

In `backend/start/env.ts`, near the other optional settings:

```ts
  // Home Assistant SSRF allowlist (cf. docs/adr/0013) — comma-separated
  // `host` or `host:port`. Empty/unset = allow all (the default: HA is
  // almost always on a private LAN address, which the usual "block private
  // ranges" SSRF mitigation would itself block).
  HOME_ASSISTANT_ALLOWED_HOSTS: Env.schema.string.optional(),
```

In `backend/.env.example`:

```
# Home Assistant SSRF allowlist — cf. docs/adr/0013. Comma-separated
# `host` or `host:port`. Empty = allow all (the default).
# HOME_ASSISTANT_ALLOWED_HOSTS=homeassistant.local:8123
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/infrastructure/home-assistant/env-host-policy.ts backend/tests/infrastructure/home-assistant/env-host-policy.spec.ts backend/start/env.ts backend/.env.example
git commit -m "feat(backend): add the Home Assistant host allowlist policy"
```

---

## Task 8: `HttpHomeAssistantClient`

**Files:**
- Create: `backend/src/infrastructure/home-assistant/http-home-assistant.client.ts`
- Test: `backend/tests/infrastructure/home-assistant/http-home-assistant.client.spec.ts`

**Interfaces:**
- Consumes: `HomeAssistantClient`/`HomeAssistantConnection`/`HomeAssistantError` (Task 4).
- Produces: `HttpHomeAssistantClient implements HomeAssistantClient`, consumed by Task 11 (connection use cases), Task 13 (reconcile), Task 14 (mirror).

Uses the exact `globalThis.fetch` stub/restore pattern already in this codebase (`tests/infrastructure/fridge/openfoodfacts-adapter.spec.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// backend/tests/infrastructure/home-assistant/http-home-assistant.client.spec.ts
import { test } from '@japa/runner'
import { HttpHomeAssistantClient } from '#infrastructure/home-assistant/http-home-assistant.client'

const connection = { instanceUrl: 'http://homeassistant.local:8123', token: 'tok' }

test.group('HttpHomeAssistantClient', (group) => {
  const originalFetch = globalThis.fetch
  group.each.teardown(() => {
    globalThis.fetch = originalFetch
  })

  test('ping() succeeds on a 200', async ({ assert }) => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'API running.' }))) as typeof fetch
    const result = await new HttpHomeAssistantClient().ping(connection)
    assert.isTrue(result.ok)
  })

  test('ping() maps a 401 to "unauthorized"', async ({ assert }) => {
    globalThis.fetch = (async () => new Response('', { status: 401 })) as typeof fetch
    const result = await new HttpHomeAssistantClient().ping(connection)
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'unauthorized')
  })

  test('ping() maps a network failure to "unreachable"', async ({ assert }) => {
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED')
    }) as typeof fetch
    const result = await new HttpHomeAssistantClient().ping(connection)
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'unreachable')
  })

  test('listTodoEntities() keeps only todo.* states', async ({ assert }) => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          { entity_id: 'todo.courses', attributes: { friendly_name: 'Courses' } },
          { entity_id: 'light.salon', attributes: { friendly_name: 'Salon' } },
        ]),
      )) as typeof fetch
    const result = await new HttpHomeAssistantClient().listTodoEntities(connection)
    assert.isTrue(result.ok)
    if (result.ok) {
      assert.lengthOf(result.value, 1)
      assert.equal(result.value[0].entityId, 'todo.courses')
      assert.equal(result.value[0].friendlyName, 'Courses')
    }
  })

  test('listItems() reads the service_response envelope for the given entity', async ({ assert }) => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          service_response: {
            'todo.courses': {
              items: [{ uid: 'u1', summary: 'Lait', description: '2 L', status: 'needs_action' }],
            },
          },
        }),
      )) as typeof fetch
    const result = await new HttpHomeAssistantClient().listItems(connection, 'todo.courses')
    assert.isTrue(result.ok)
    if (result.ok) {
      assert.lengthOf(result.value, 1)
      assert.equal(result.value[0].uid, 'u1')
      assert.equal(result.value[0].description, '2 L')
    }
  })

  test('addItem()/updateItem()/removeItem() succeed on a 200', async ({ assert }) => {
    globalThis.fetch = (async () => new Response('[]')) as typeof fetch
    const client = new HttpHomeAssistantClient()
    assert.isTrue((await client.addItem(connection, 'todo.courses', { summary: 'Pain', description: '1 pièce' })).ok)
    assert.isTrue((await client.updateItem(connection, 'todo.courses', 'u1', { status: 'completed' })).ok)
    assert.isTrue((await client.removeItem(connection, 'todo.courses', 'u1')).ok)
  })

  test('a non-2xx, non-401/403 status maps to "unexpected_response"', async ({ assert }) => {
    globalThis.fetch = (async () => new Response('', { status: 500 })) as typeof fetch
    const result = await new HttpHomeAssistantClient().ping(connection)
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'unexpected_response')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && node ace test --files tests/infrastructure/home-assistant/http-home-assistant.client.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/infrastructure/home-assistant/http-home-assistant.client.ts
import type {
  HomeAssistantClient,
  HomeAssistantConnection,
} from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { TodoEntity } from '#domain/home-assistant/todo-entity'
import type { TodoItem } from '#domain/home-assistant/todo-item'
import type { HomeAssistantError } from '#domain/home-assistant/home-assistant-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

const TIMEOUT_MS = 5000
const MAX_RESPONSE_BYTES = 1_000_000

/** Cf. design §6/§7: 5s timeout, no redirects followed, a response-size cap,
 * bearer auth. Never logs the token or a request/response body. */
async function haFetch(
  connection: HomeAssistantConnection,
  path: string,
  init?: RequestInit,
): Promise<ResultType<unknown, HomeAssistantError>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${connection.instanceUrl}${path}`, {
      ...init,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${connection.token}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })

    if (response.status === 401 || response.status === 403) return Result.err('unauthorized')
    if (!response.ok) return Result.err('unexpected_response')

    const contentLength = response.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) return Result.err('unexpected_response')

    const text = await response.text()
    if (text.length > MAX_RESPONSE_BYTES) return Result.err('unexpected_response')
    return Result.ok(text.length > 0 ? JSON.parse(text) : null)
  } catch {
    return Result.err('unreachable')
  } finally {
    clearTimeout(timeout)
  }
}

export class HttpHomeAssistantClient implements HomeAssistantClient {
  async ping(connection: HomeAssistantConnection): Promise<ResultType<void, HomeAssistantError>> {
    const result = await haFetch(connection, '/api/')
    return result.ok ? Result.ok(undefined) : result
  }

  async listTodoEntities(
    connection: HomeAssistantConnection,
  ): Promise<ResultType<TodoEntity[], HomeAssistantError>> {
    const result = await haFetch(connection, '/api/states')
    if (!result.ok) return result
    const states = result.value as Array<{ entity_id: string; attributes?: { friendly_name?: string } }>
    const entities = states
      .filter((state) => state.entity_id.startsWith('todo.'))
      .map((state) => ({
        entityId: state.entity_id,
        friendlyName: state.attributes?.friendly_name ?? state.entity_id,
      }))
    return Result.ok(entities)
  }

  async listItems(
    connection: HomeAssistantConnection,
    entityId: string,
  ): Promise<ResultType<TodoItem[], HomeAssistantError>> {
    const result = await haFetch(connection, '/api/services/todo/get_items?return_response', {
      method: 'POST',
      body: JSON.stringify({ entity_id: entityId }),
    })
    if (!result.ok) return result
    const body = result.value as {
      service_response?: Record<
        string,
        { items?: Array<{ uid: string; summary: string; description?: string | null; status: string }> }
      >
    }
    const raw = body.service_response?.[entityId]?.items ?? []
    const items: TodoItem[] = raw.map((item) => ({
      uid: item.uid,
      summary: item.summary,
      description: item.description ?? null,
      status: item.status === 'completed' ? 'completed' : 'needs_action',
    }))
    return Result.ok(items)
  }

  async addItem(
    connection: HomeAssistantConnection,
    entityId: string,
    item: { summary: string; description: string },
  ): Promise<ResultType<void, HomeAssistantError>> {
    const result = await haFetch(connection, '/api/services/todo/add_item', {
      method: 'POST',
      body: JSON.stringify({ entity_id: entityId, item: item.summary, description: item.description }),
    })
    return result.ok ? Result.ok(undefined) : result
  }

  async updateItem(
    connection: HomeAssistantConnection,
    entityId: string,
    uid: string,
    patch: { summary?: string; description?: string; status?: 'needs_action' | 'completed' },
  ): Promise<ResultType<void, HomeAssistantError>> {
    const result = await haFetch(connection, '/api/services/todo/update_item', {
      method: 'POST',
      body: JSON.stringify({
        entity_id: entityId,
        item: uid,
        ...(patch.summary !== undefined ? { rename: patch.summary } : null),
        ...(patch.description !== undefined ? { description: patch.description } : null),
        ...(patch.status !== undefined ? { status: patch.status } : null),
      }),
    })
    return result.ok ? Result.ok(undefined) : result
  }

  async removeItem(
    connection: HomeAssistantConnection,
    entityId: string,
    uid: string,
  ): Promise<ResultType<void, HomeAssistantError>> {
    const result = await haFetch(connection, '/api/services/todo/remove_item', {
      method: 'POST',
      body: JSON.stringify({ entity_id: entityId, item: uid }),
    })
    return result.ok ? Result.ok(undefined) : result
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && node ace test --files tests/infrastructure/home-assistant/http-home-assistant.client.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/infrastructure/home-assistant/http-home-assistant.client.ts backend/tests/infrastructure/home-assistant/http-home-assistant.client.spec.ts
git commit -m "feat(backend): add the HTTP client for Home Assistant's REST API"
```

---

## Task 9: Persistence — `home_assistant_link` repository, `shopping_item` repository update

**Files:**
- Create: `backend/src/infrastructure/database/home-assistant/home-assistant-link.lucid.ts`
- Create: `backend/src/infrastructure/database/home-assistant/home-assistant-link.mapper.ts`
- Create: `backend/src/infrastructure/database/home-assistant/home-assistant-link.repository.ts`
- Test: `backend/tests/infrastructure/home-assistant/home-assistant-link.repository.spec.ts`
- Modify: `backend/src/infrastructure/database/shopping-list/shopping-item.lucid.ts` (add `haUid`/`haSyncedAt` columns)
- Modify: `backend/src/infrastructure/database/shopping-list/shopping-item.mapper.ts` (thread the two new fields through)
- Modify: `backend/src/infrastructure/database/shopping-list/shopping-item.repository.ts` (implement `clearHomeAssistantSync`, save the two new columns)
- Modify: `backend/tests/infrastructure/shopping-list/shopping-item.repository.spec.ts` (extend)

**Interfaces:**
- Consumes: `HomeAssistantLink` (Task 4), `Encryption` (Task 1), `LinkUnreadableError` (Task 4).
- Produces: `LucidHomeAssistantLinkRepository implements HomeAssistantLinkRepository`, `LucidShoppingItemRepository.clearHomeAssistantSync(householdId): Promise<void>` — consumed by Task 11–14 use cases and by Task 12's unlink.

Encryption happens **only** at this mapper boundary (design §2) — the aggregate never sees a cipher.

- [ ] **Step 1: Write the failing repository test**

```ts
// backend/tests/infrastructure/home-assistant/home-assistant-link.repository.spec.ts
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { LucidHomeAssistantLinkRepository } from '#infrastructure/database/home-assistant/home-assistant-link.repository'
import { AesGcmEncryption } from '#infrastructure/shared/aes-gcm-encryption'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import db from '@adonisjs/lucid/services/db'

const KEY = Buffer.from('ci-test-encryption-key-32-bytes!')

function url(raw: string) {
  const result = InstanceUrl.create(raw)
  if (!result.ok) throw new Error('bad fixture URL')
  return result.value
}

test.group('LucidHomeAssistantLinkRepository', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('save() then find() round-trips, token decrypted transparently', async ({ assert }) => {
    const repository = new LucidHomeAssistantLinkRepository(new AesGcmEncryption(KEY))
    const household = await db.table('household').insert({
      id: 'household-ha-1',
      name: 'Foyer',
      owner_id: 'user-ha-1',
      invite_code: 'ZZ999999',
      created_at: new Date(),
    })
    // (adjust the insert above to whatever columns `household` actually
    // requires — cf. household.repository.spec.ts for the exact fixture shape)
    void household

    const link = HomeAssistantLink.create({
      id: 'link-ha-1',
      householdId: 'household-ha-1',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'super-secret-token',
      createdAt: new Date(),
    })
    await repository.save(link)

    const found = await repository.find('household-ha-1')
    assert.isNotNull(found)
    assert.equal(found?.token, 'super-secret-token')
    assert.equal(found?.instanceUrl.value, 'http://homeassistant.local:8123')
  })

  test('the stored encrypted_token column never contains the plaintext', async ({ assert }) => {
    const repository = new LucidHomeAssistantLinkRepository(new AesGcmEncryption(KEY))
    await db.table('household').insert({
      id: 'household-ha-2',
      name: 'Foyer',
      owner_id: 'user-ha-2',
      invite_code: 'ZZ888888',
      created_at: new Date(),
    })
    const link = HomeAssistantLink.create({
      id: 'link-ha-2',
      householdId: 'household-ha-2',
      instanceUrl: url('http://homeassistant.local:8123'),
      token: 'super-secret-token',
      createdAt: new Date(),
    })
    await repository.save(link)

    const row = await db.from('home_assistant_link').where('id', 'link-ha-2').first()
    assert.notInclude(row.encrypted_token, 'super-secret-token')
  })

  test('find() returns null when no link exists for the household', async ({ assert }) => {
    const repository = new LucidHomeAssistantLinkRepository(new AesGcmEncryption(KEY))
    assert.isNull(await repository.find('no-such-household'))
  })
})
```

Before writing this, run `cat backend/tests/infrastructure/identity/household.repository.spec.ts` to copy the *exact* household-fixture insert shape that test file already uses (columns/required fields for `household`), and fix the two inserts above to match it exactly — do not guess the schema.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && node ace test --files tests/infrastructure/home-assistant/home-assistant-link.repository.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the Lucid model**

```ts
// backend/src/infrastructure/database/home-assistant/home-assistant-link.lucid.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { SyncDirectionValue } from '#domain/home-assistant/sync-direction.vo'

export default class HomeAssistantLinkModel extends BaseModel {
  static table = 'home_assistant_link'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'instance_url' })
  declare instanceUrl: string

  @column({ columnName: 'encrypted_token' })
  declare encryptedToken: string

  @column({ columnName: 'todo_entity_id' })
  declare todoEntityId: string | null

  @column({ columnName: 'todo_entity_name' })
  declare todoEntityName: string | null

  @column()
  declare direction: SyncDirectionValue

  @column()
  declare enabled: boolean

  @column.dateTime({ columnName: 'last_sync_at' })
  declare lastSyncAt: DateTime | null

  @column({ columnName: 'last_error' })
  declare lastError: string | null

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

- [ ] **Step 4: Implement the mapper (encryption boundary)**

```ts
// backend/src/infrastructure/database/home-assistant/home-assistant-link.mapper.ts
import { DateTime } from 'luxon'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { SyncDirection } from '#domain/home-assistant/sync-direction.vo'
import { LinkUnreadableError } from '#domain/home-assistant/link-unreadable.error'
import type { Encryption } from '#domain/shared/encryption.interface'
import type HomeAssistantLinkModel from './home-assistant-link.lucid.js'

export function toDomain(row: HomeAssistantLinkModel, encryption: Encryption): HomeAssistantLink {
  const instanceUrl = InstanceUrl.create(row.instanceUrl)
  if (!instanceUrl.ok) {
    throw new Error(`Corrupted home_assistant_link row ${row.id}: ${instanceUrl.error.message}`)
  }

  const direction = SyncDirection.create(row.direction)
  if (!direction.ok) {
    throw new Error(`Corrupted home_assistant_link row ${row.id}: ${direction.error.message}`)
  }

  let token: string
  try {
    token = encryption.decrypt(row.encryptedToken)
  } catch {
    throw new LinkUnreadableError(row.id)
  }

  return HomeAssistantLink.reconstruct(row.id, {
    householdId: row.householdId,
    instanceUrl: instanceUrl.value,
    token,
    todoEntityId: row.todoEntityId,
    todoEntityName: row.todoEntityName,
    direction: direction.value,
    enabled: row.enabled,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toJSDate() : null,
    lastError: row.lastError,
    createdAt: row.createdAt.toJSDate(),
    updatedAt: row.updatedAt.toJSDate(),
  })
}

export function toPersistence(link: HomeAssistantLink, encryption: Encryption) {
  return {
    id: link.id,
    householdId: link.householdId,
    instanceUrl: link.instanceUrl.value,
    encryptedToken: encryption.encrypt(link.token),
    todoEntityId: link.todoEntityId,
    todoEntityName: link.todoEntityName,
    direction: link.direction.value,
    enabled: link.enabled,
    lastSyncAt: link.lastSyncAt ? DateTime.fromJSDate(link.lastSyncAt) : null,
    lastError: link.lastError,
  }
}
```

- [ ] **Step 5: Implement the repository**

```ts
// backend/src/infrastructure/database/home-assistant/home-assistant-link.repository.ts
import HomeAssistantLinkModel from './home-assistant-link.lucid.js'
import { toDomain, toPersistence } from './home-assistant-link.mapper.js'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import type { Encryption } from '#domain/shared/encryption.interface'

export class LucidHomeAssistantLinkRepository implements HomeAssistantLinkRepository {
  constructor(private readonly encryption: Encryption) {}

  async find(householdId: string): Promise<HomeAssistantLink | null> {
    const row = await HomeAssistantLinkModel.query().where('household_id', householdId).first()
    return row ? toDomain(row, this.encryption) : null
  }

  async save(link: HomeAssistantLink): Promise<void> {
    const { id, ...attrs } = toPersistence(link, this.encryption)
    await HomeAssistantLinkModel.updateOrCreate({ id }, attrs)
  }

  async delete(householdId: string): Promise<void> {
    await HomeAssistantLinkModel.query().where('household_id', householdId).delete()
  }
}
```

- [ ] **Step 6: Run to verify the repository test passes**

Run: `cd backend && node ace test --files tests/infrastructure/home-assistant/home-assistant-link.repository.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Update the shopping-item Lucid model, mapper, repository**

Read the current three files first (`cat backend/src/infrastructure/database/shopping-list/shopping-item.{lucid,mapper}.ts backend/src/infrastructure/database/shopping-list/shopping-item.repository.ts`), then modify:

In `shopping-item.lucid.ts`, add:

```ts
  @column({ columnName: 'ha_uid' })
  declare haUid: string | null

  @column.dateTime({ columnName: 'ha_synced_at' })
  declare haSyncedAt: DateTime | null
```

In `shopping-item.mapper.ts`'s `toDomain`, add to the `reconstruct(...)` props:

```ts
    haUid: row.haUid,
    haSyncedAt: row.haSyncedAt ? row.haSyncedAt.toJSDate() : null,
```

In `shopping-item.repository.ts`, extend the `save()` write and add `clearHomeAssistantSync`:

```ts
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
        haUid: item.haUid,
        haSyncedAt: item.haSyncedAt ? DateTime.fromJSDate(item.haSyncedAt) : null,
      },
    )
  }

  async clearHomeAssistantSync(householdId: string): Promise<void> {
    await ShoppingItemModel.query()
      .where('household_id', householdId)
      .update({ ha_uid: null, ha_synced_at: null })
  }
```

(add `import { DateTime } from 'luxon'` at the top if it isn't already imported there).

- [ ] **Step 8: Extend the shopping-item repository test**

Append to `backend/tests/infrastructure/shopping-list/shopping-item.repository.spec.ts` (read it first):

```ts
  test('save() persists haUid/haSyncedAt, and clearHomeAssistantSync() wipes them', async ({ assert }) => {
    const repository = new LucidShoppingItemRepository()
    // build a ShoppingItem the same way the rest of this file's fixtures do,
    // then:
    item.markSynced('ha-uid-1', new Date())
    await repository.save(item)

    const reread = await repository.findById(item.id)
    assert.equal(reread?.haUid, 'ha-uid-1')
    assert.isNotNull(reread?.haSyncedAt)

    await repository.clearHomeAssistantSync(item.householdId)
    const cleared = await repository.findById(item.id)
    assert.isNull(cleared?.haUid)
    assert.isNull(cleared?.haSyncedAt)
  })
```

(Match this test's household/item setup to whatever fixture pattern the rest of that spec file already uses — read the file fully before appending, don't introduce a second fixture style.)

- [ ] **Step 9: Run the full shopping-list and home-assistant infrastructure suites**

Run: `cd backend && node ace test --files "tests/infrastructure/shopping-list/**/*.spec.ts" --files "tests/infrastructure/home-assistant/**/*.spec.ts"`
Expected: all PASS.

- [ ] **Step 10: Typecheck**

Run: `cd backend && pnpm run typecheck`
Expected: no errors — this is the point where the `clearHomeAssistantSync` gap flagged at the end of Task 5 closes.

- [ ] **Step 11: Commit**

```bash
git add backend/src/infrastructure/database/home-assistant backend/tests/infrastructure/home-assistant/home-assistant-link.repository.spec.ts backend/src/infrastructure/database/shopping-list backend/tests/infrastructure/shopping-list/shopping-item.repository.spec.ts
git commit -m "feat(backend): persist the Home Assistant link and shopping-item sync bookmarks"
```

---

## Task 10: Connection use cases — `GetHomeAssistantLink`, `SaveHomeAssistantConnection`, `DiscoverTodoEntities`

**Files:**
- Create: `backend/src/application/home-assistant/get-home-assistant-link.use-case.ts`
- Create: `backend/src/application/home-assistant/save-home-assistant-connection.use-case.ts`
- Create: `backend/src/application/home-assistant/discover-todo-entities.use-case.ts`
- Test: `backend/tests/unit/application/home-assistant/get-home-assistant-link.use-case.spec.ts`
- Test: `backend/tests/unit/application/home-assistant/save-home-assistant-connection.use-case.spec.ts`
- Test: `backend/tests/unit/application/home-assistant/discover-todo-entities.use-case.spec.ts`

**Interfaces:**
- Consumes: `HomeAssistantLinkRepository`, `HomeAssistantClient`, `HostPolicy` (Task 4), `HouseholdRepository` (`#domain/identity/interfaces/household-repository.interface`), `IdGenerator`/`Clock` (`#domain/shared`), `LinkUnreadableError` (Task 4), `InstanceUrl` (Task 2), `HomeAssistantLink` (Task 4).
- Produces: `GetHomeAssistantLink`, `SaveHomeAssistantConnection`, `DiscoverTodoEntities` — each a `UseCase`, consumed by the controller in Task 13.

All three tests use hand-written fakes (this codebase's convention — no mocking library). Write one small shared fake file first.

- [ ] **Step 1: Write shared test fakes**

```ts
// backend/tests/unit/application/home-assistant/fakes.ts
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantClient, HomeAssistantConnection } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import type { Household } from '#domain/identity/household.aggregate'
import type { TodoEntity } from '#domain/home-assistant/todo-entity'
import type { TodoItem } from '#domain/home-assistant/todo-item'
import type { HomeAssistantError } from '#domain/home-assistant/home-assistant-error'
import { Result } from '#domain/shared/result'

export class FakeHomeAssistantLinkRepository implements HomeAssistantLinkRepository {
  private byHousehold = new Map<string, HomeAssistantLink>()

  async find(householdId: string) {
    return this.byHousehold.get(householdId) ?? null
  }
  async save(link: HomeAssistantLink) {
    this.byHousehold.set(link.householdId, link)
  }
  async delete(householdId: string) {
    this.byHousehold.delete(householdId)
  }
}

export class FakeHouseholdRepository implements HouseholdRepository {
  constructor(private readonly households: Household[]) {}
  async findById(id: string) {
    return this.households.find((h) => h.id === id) ?? null
  }
  async findByUserId(userId: string) {
    return this.households.find((h) => h.members.some((m) => m.userId === userId)) ?? null
  }
  async findByInviteCode() {
    return null
  }
  async save() {}
  async delete() {}
}

export class FakeHostPolicy implements HostPolicy {
  constructor(private readonly allowed = true) {}
  isAllowed() {
    return this.allowed
  }
}

export class FakeHomeAssistantClient implements HomeAssistantClient {
  constructor(
    private readonly options: {
      pingError?: HomeAssistantError
      entities?: TodoEntity[]
      items?: TodoItem[]
    } = {},
  ) {}
  async ping(): Promise<ReturnType<HomeAssistantClient['ping']>> {
    return this.options.pingError ? Result.err(this.options.pingError) : Result.ok(undefined)
  }
  async listTodoEntities() {
    return Result.ok(this.options.entities ?? [])
  }
  async listItems() {
    return Result.ok(this.options.items ?? [])
  }
  async addItem() {
    return Result.ok(undefined)
  }
  async updateItem() {
    return Result.ok(undefined)
  }
  async removeItem() {
    return Result.ok(undefined)
  }
}

export const FIXED_CLOCK = { now: () => new Date('2026-09-07T12:00:00.000Z') }
export const SEQUENTIAL_IDS = (prefix: string) => {
  let n = 0
  return { next: () => `${prefix}-${++n}` }
}
```

(This mirrors what `households.findByUserId`/`Household`/`HouseholdMember` actually look like — read `backend/src/domain/identity/household.aggregate.ts` and `household-member.entity.ts` again if any field name above doesn't match; fix the fake, not the real aggregate.)

- [ ] **Step 2: Write the failing test for `GetHomeAssistantLink`**

```ts
// backend/tests/unit/application/home-assistant/get-home-assistant-link.use-case.spec.ts
import { test } from '@japa/runner'
import { GetHomeAssistantLink } from '#application/home-assistant/get-home-assistant-link.use-case'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { LinkUnreadableError } from '#domain/home-assistant/link-unreadable.error'
import { FakeHomeAssistantLinkRepository } from './fakes.js'

test.group('GetHomeAssistantLink', () => {
  test('returns null when no link is configured', async ({ assert }) => {
    const result = await new GetHomeAssistantLink(new FakeHomeAssistantLinkRepository()).execute({
      householdId: 'household-1',
    })
    assert.isTrue(result.ok)
    if (result.ok) assert.isNull(result.value)
  })

  test('returns the link when one exists', async ({ assert }) => {
    const repository = new FakeHomeAssistantLinkRepository()
    const urlResult = InstanceUrl.create('http://homeassistant.local:8123')
    if (!urlResult.ok) throw new Error('bad fixture')
    await repository.save(
      HomeAssistantLink.create({
        id: 'link-1',
        householdId: 'household-1',
        instanceUrl: urlResult.value,
        token: 'tok',
        createdAt: new Date(),
      }),
    )
    const result = await new GetHomeAssistantLink(repository).execute({ householdId: 'household-1' })
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value?.id, 'link-1')
  })

  test('translates a LinkUnreadableError into Result.err("link_unreadable")', async ({ assert }) => {
    const repository = new FakeHomeAssistantLinkRepository()
    repository.find = async () => {
      throw new LinkUnreadableError('link-1')
    }
    const result = await new GetHomeAssistantLink(repository).execute({ householdId: 'household-1' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'link_unreadable')
  })
})
```

- [ ] **Step 3: Write the failing tests for `SaveHomeAssistantConnection`**

```ts
// backend/tests/unit/application/home-assistant/save-home-assistant-connection.use-case.spec.ts
import { test } from '@japa/runner'
import { SaveHomeAssistantConnection } from '#application/home-assistant/save-home-assistant-connection.use-case'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import {
  FakeHomeAssistantLinkRepository,
  FakeHomeAssistantClient,
  FakeHostPolicy,
  FakeHouseholdRepository,
  FIXED_CLOCK,
  SEQUENTIAL_IDS,
} from './fakes.js'

function ownerHousehold(): Household {
  const invite = InviteCode.create('ZZ999999')
  if (!invite.ok) throw new Error('bad fixture invite code')
  return Household.create({
    id: 'household-1',
    name: 'Foyer',
    ownerId: 'owner-1',
    ownerMemberId: 'member-1',
    inviteCode: invite.value,
    createdAt: new Date(),
  })
}

test.group('SaveHomeAssistantConnection', () => {
  test('rejects a non-owner', async ({ assert }) => {
    const useCase = new SaveHomeAssistantConnection(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
      SEQUENTIAL_IDS('link'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({
      userId: 'not-the-owner',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:8123',
      token: 'tok',
    })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'not_owner')
  })

  test('rejects an invalid URL', async ({ assert }) => {
    const useCase = new SaveHomeAssistantConnection(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
      SEQUENTIAL_IDS('link'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'not a url',
      token: 'tok',
    })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'invalid_url')
  })

  test('rejects a disallowed host', async ({ assert }) => {
    const useCase = new SaveHomeAssistantConnection(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(false),
      new FakeHouseholdRepository([ownerHousehold()]),
      SEQUENTIAL_IDS('link'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://evil.example.com',
      token: 'tok',
    })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'host_not_allowed')
  })

  test('rejects a token Home Assistant refuses', async ({ assert }) => {
    const useCase = new SaveHomeAssistantConnection(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient({ pingError: 'unauthorized' }),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
      SEQUENTIAL_IDS('link'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:8123',
      token: 'wrong-token',
    })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'unauthorized')
  })

  test('rejects a first save with no token', async ({ assert }) => {
    const useCase = new SaveHomeAssistantConnection(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
      SEQUENTIAL_IDS('link'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:8123',
      token: '',
    })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'token_required')
  })

  test('succeeds and creates a new link on first save', async ({ assert }) => {
    const links = new FakeHomeAssistantLinkRepository()
    const useCase = new SaveHomeAssistantConnection(
      links,
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
      SEQUENTIAL_IDS('link'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:8123',
      token: 'tok',
    })
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value.token, 'tok')
    assert.isNotNull(await links.find('household-1'))
  })

  test('a blank token on an existing link keeps the stored one', async ({ assert }) => {
    const links = new FakeHomeAssistantLinkRepository()
    const householdRepository = new FakeHouseholdRepository([ownerHousehold()])
    const client = new FakeHomeAssistantClient()
    const clock = FIXED_CLOCK
    const ids = SEQUENTIAL_IDS('link')

    await new SaveHomeAssistantConnection(links, client, new FakeHostPolicy(), householdRepository, ids, clock).execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:8123',
      token: 'original-token',
    })

    const result = await new SaveHomeAssistantConnection(
      links,
      client,
      new FakeHostPolicy(),
      householdRepository,
      ids,
      clock,
    ).execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:9999',
      token: '',
    })
    assert.isTrue(result.ok)
    if (result.ok) {
      assert.equal(result.value.token, 'original-token')
      assert.equal(result.value.instanceUrl.value, 'http://homeassistant.local:9999')
    }
  })
})
```

- [ ] **Step 4: Write the failing tests for `DiscoverTodoEntities`**

```ts
// backend/tests/unit/application/home-assistant/discover-todo-entities.use-case.spec.ts
import { test } from '@japa/runner'
import { DiscoverTodoEntities } from '#application/home-assistant/discover-todo-entities.use-case'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import {
  FakeHomeAssistantLinkRepository,
  FakeHomeAssistantClient,
  FakeHostPolicy,
  FakeHouseholdRepository,
} from './fakes.js'

function ownerHousehold(): Household {
  const invite = InviteCode.create('ZZ999999')
  if (!invite.ok) throw new Error('bad fixture invite code')
  return Household.create({
    id: 'household-1',
    name: 'Foyer',
    ownerId: 'owner-1',
    ownerMemberId: 'member-1',
    inviteCode: invite.value,
    createdAt: new Date(),
  })
}

test.group('DiscoverTodoEntities', () => {
  test('rejects a non-owner', async ({ assert }) => {
    const useCase = new DiscoverTodoEntities(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
    )
    const result = await useCase.execute({ userId: 'not-owner', householdId: 'household-1' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'not_owner')
  })

  test('with inline credentials, discovers without needing a stored link', async ({ assert }) => {
    const useCase = new DiscoverTodoEntities(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient({ entities: [{ entityId: 'todo.courses', friendlyName: 'Courses' }] }),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
    )
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      instanceUrl: 'http://homeassistant.local:8123',
      token: 'tok',
    })
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value[0].entityId, 'todo.courses')
  })

  test('with no inline credentials and no stored link, fails with link_not_found', async ({ assert }) => {
    const useCase = new DiscoverTodoEntities(
      new FakeHomeAssistantLinkRepository(),
      new FakeHomeAssistantClient(),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
    )
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'link_not_found')
  })

  test('with no inline credentials, uses the stored link', async ({ assert }) => {
    const links = new FakeHomeAssistantLinkRepository()
    const urlResult = InstanceUrl.create('http://homeassistant.local:8123')
    if (!urlResult.ok) throw new Error('bad fixture')
    await links.save(
      HomeAssistantLink.create({
        id: 'link-1',
        householdId: 'household-1',
        instanceUrl: urlResult.value,
        token: 'stored-token',
        createdAt: new Date(),
      }),
    )
    const useCase = new DiscoverTodoEntities(
      links,
      new FakeHomeAssistantClient({ entities: [{ entityId: 'todo.courses', friendlyName: 'Courses' }] }),
      new FakeHostPolicy(),
      new FakeHouseholdRepository([ownerHousehold()]),
    )
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1' })
    assert.isTrue(result.ok)
  })
})
```

- [ ] **Step 5: Run to verify all three fail**

Run: `cd backend && node ace test --files "tests/unit/application/home-assistant/*.spec.ts"`
Expected: FAIL — modules not found.

- [ ] **Step 6: Implement `GetHomeAssistantLink`**

```ts
// backend/src/application/home-assistant/get-home-assistant-link.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { LinkUnreadableError } from '#domain/home-assistant/link-unreadable.error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface GetHomeAssistantLinkInput {
  householdId: string
}

export type GetHomeAssistantLinkError = 'link_unreadable'

export class GetHomeAssistantLink
  implements UseCase<GetHomeAssistantLinkInput, ResultType<HomeAssistantLink | null, GetHomeAssistantLinkError>>
{
  constructor(private readonly links: HomeAssistantLinkRepository) {}

  async execute(
    input: GetHomeAssistantLinkInput,
  ): Promise<ResultType<HomeAssistantLink | null, GetHomeAssistantLinkError>> {
    try {
      return Result.ok(await this.links.find(input.householdId))
    } catch (error) {
      if (error instanceof LinkUnreadableError) return Result.err('link_unreadable')
      throw error
    }
  }
}
```

- [ ] **Step 7: Implement `SaveHomeAssistantConnection`**

```ts
// backend/src/application/home-assistant/save-home-assistant-connection.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantClient } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import type { HomeAssistantError } from '#domain/home-assistant/home-assistant-error'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface SaveHomeAssistantConnectionInput {
  userId: string
  householdId: string
  instanceUrl: string
  token: string
}

export type SaveHomeAssistantConnectionError =
  | 'not_owner'
  | 'token_required'
  | 'invalid_url'
  | 'host_not_allowed'
  | HomeAssistantError

export class SaveHomeAssistantConnection
  implements UseCase<SaveHomeAssistantConnectionInput, ResultType<HomeAssistantLink, SaveHomeAssistantConnectionError>>
{
  constructor(
    private readonly links: HomeAssistantLinkRepository,
    private readonly client: HomeAssistantClient,
    private readonly hostPolicy: HostPolicy,
    private readonly households: HouseholdRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: SaveHomeAssistantConnectionInput,
  ): Promise<ResultType<HomeAssistantLink, SaveHomeAssistantConnectionError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household || household.ownerId !== input.userId) return Result.err('not_owner')

    const urlResult = InstanceUrl.create(input.instanceUrl)
    if (!urlResult.ok) return Result.err('invalid_url')

    if (!this.hostPolicy.isAllowed(urlResult.value)) return Result.err('host_not_allowed')

    const existing = await this.links.find(input.householdId)
    // A blank token keeps the one already stored, so the owner can fix the
    // URL alone without re-pasting the long-lived token (design §6).
    const token = input.token.length > 0 ? input.token : existing?.token
    if (!token) return Result.err('token_required')

    const ping = await this.client.ping({ instanceUrl: urlResult.value.value, token })
    if (!ping.ok) return Result.err(ping.error)

    const now = this.clock.now()
    const link =
      existing ??
      HomeAssistantLink.create({
        id: this.idGenerator.next(),
        householdId: input.householdId,
        instanceUrl: urlResult.value,
        token,
        createdAt: now,
      })
    link.updateConnection(urlResult.value, token, now)

    await this.links.save(link)
    return Result.ok(link)
  }
}
```

- [ ] **Step 8: Implement `DiscoverTodoEntities`**

```ts
// backend/src/application/home-assistant/discover-todo-entities.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantClient } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { TodoEntity } from '#domain/home-assistant/todo-entity'
import type { HomeAssistantError } from '#domain/home-assistant/home-assistant-error'
import type { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { InstanceUrl as InstanceUrlVO } from '#domain/home-assistant/instance-url.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface DiscoverTodoEntitiesInput {
  userId: string
  householdId: string
  instanceUrl?: string
  token?: string
}

export type DiscoverTodoEntitiesError = 'not_owner' | 'invalid_url' | 'host_not_allowed' | 'link_not_found' | HomeAssistantError

export class DiscoverTodoEntities
  implements UseCase<DiscoverTodoEntitiesInput, ResultType<TodoEntity[], DiscoverTodoEntitiesError>>
{
  constructor(
    private readonly links: HomeAssistantLinkRepository,
    private readonly client: HomeAssistantClient,
    private readonly hostPolicy: HostPolicy,
    private readonly households: HouseholdRepository,
  ) {}

  async execute(input: DiscoverTodoEntitiesInput): Promise<ResultType<TodoEntity[], DiscoverTodoEntitiesError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household || household.ownerId !== input.userId) return Result.err('not_owner')

    let instanceUrl: InstanceUrl
    let token: string

    if (input.instanceUrl || input.token) {
      const urlResult = InstanceUrlVO.create(input.instanceUrl ?? '')
      if (!urlResult.ok) return Result.err('invalid_url')
      instanceUrl = urlResult.value
      token = input.token ?? ''
    } else {
      const existing = await this.links.find(input.householdId)
      if (!existing) return Result.err('link_not_found')
      instanceUrl = existing.instanceUrl
      token = existing.token
    }

    if (!this.hostPolicy.isAllowed(instanceUrl)) return Result.err('host_not_allowed')

    return this.client.listTodoEntities({ instanceUrl: instanceUrl.value, token })
  }
}
```

- [ ] **Step 9: Run to verify all pass**

Run: `cd backend && node ace test --files "tests/unit/application/home-assistant/*.spec.ts"`
Expected: PASS, all tests across the three files.

- [ ] **Step 10: Typecheck and boundary-lint**

Run: `cd backend && pnpm run typecheck && pnpm run boundaries`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add backend/src/application/home-assistant/get-home-assistant-link.use-case.ts backend/src/application/home-assistant/save-home-assistant-connection.use-case.ts backend/src/application/home-assistant/discover-todo-entities.use-case.ts backend/tests/unit/application/home-assistant
git commit -m "feat(backend): add the Home Assistant connection use cases"
```

---

## Task 11: `BindHomeAssistantList` and `UnlinkHomeAssistant` use cases

**Files:**
- Create: `backend/src/application/home-assistant/bind-home-assistant-list.use-case.ts`
- Create: `backend/src/application/home-assistant/unlink-home-assistant.use-case.ts`
- Test: `backend/tests/unit/application/home-assistant/bind-home-assistant-list.use-case.spec.ts`
- Test: `backend/tests/unit/application/home-assistant/unlink-home-assistant.use-case.spec.ts`

**Interfaces:**
- Consumes: `HomeAssistantLinkRepository`, `HomeAssistantLink` (Task 4), `ShoppingItemRepository` (Task 5), `HouseholdRepository`, `Clock`, `SyncDirection` (Task 3).
- Produces: `BindHomeAssistantList`, `UnlinkHomeAssistant` — `UseCase`s, consumed by the controller in Task 13.

- [ ] **Step 1: Write the failing tests for `BindHomeAssistantList`**

Add a `FakeShoppingItemRepository` to `backend/tests/unit/application/home-assistant/fakes.ts` (append to the file from Task 10):

```ts
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'

export class FakeShoppingItemRepository implements ShoppingItemRepository {
  private items = new Map<string, ShoppingItem>()
  async findById(id: string) {
    return this.items.get(id) ?? null
  }
  async findByHousehold(householdId: string) {
    return [...this.items.values()].filter((item) => item.householdId === householdId)
  }
  async save(item: ShoppingItem) {
    this.items.set(item.id, item)
  }
  async delete(id: string) {
    this.items.delete(id)
  }
  async clearHomeAssistantSync(householdId: string) {
    for (const item of this.items.values()) {
      if (item.householdId === householdId) item.markSynced(null, new Date())
    }
  }
}
```

```ts
// backend/tests/unit/application/home-assistant/bind-home-assistant-list.use-case.spec.ts
import { test } from '@japa/runner'
import { BindHomeAssistantList } from '#application/home-assistant/bind-home-assistant-list.use-case'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { FakeHomeAssistantLinkRepository, FakeHouseholdRepository, FIXED_CLOCK } from './fakes.js'

function ownerHousehold(): Household {
  const invite = InviteCode.create('ZZ999999')
  if (!invite.ok) throw new Error('bad fixture')
  return Household.create({
    id: 'household-1',
    name: 'Foyer',
    ownerId: 'owner-1',
    ownerMemberId: 'member-1',
    inviteCode: invite.value,
    createdAt: new Date(),
  })
}

async function seededLinks(): Promise<FakeHomeAssistantLinkRepository> {
  const links = new FakeHomeAssistantLinkRepository()
  const urlResult = InstanceUrl.create('http://homeassistant.local:8123')
  if (!urlResult.ok) throw new Error('bad fixture')
  await links.save(
    HomeAssistantLink.create({
      id: 'link-1',
      householdId: 'household-1',
      instanceUrl: urlResult.value,
      token: 'tok',
      createdAt: new Date(),
    }),
  )
  return links
}

test.group('BindHomeAssistantList', () => {
  test('rejects a non-owner', async ({ assert }) => {
    const useCase = new BindHomeAssistantList(await seededLinks(), new FakeHouseholdRepository([ownerHousehold()]), FIXED_CLOCK)
    const result = await useCase.execute({ userId: 'not-owner', householdId: 'household-1', todoEntityId: 'todo.courses' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'not_owner')
  })

  test('fails with link_not_found when there is nothing to bind onto', async ({ assert }) => {
    const useCase = new BindHomeAssistantList(
      new FakeHomeAssistantLinkRepository(),
      new FakeHouseholdRepository([ownerHousehold()]),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1', todoEntityId: 'todo.courses' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'link_not_found')
  })

  test('binds the entity id and name together', async ({ assert }) => {
    const useCase = new BindHomeAssistantList(await seededLinks(), new FakeHouseholdRepository([ownerHousehold()]), FIXED_CLOCK)
    const result = await useCase.execute({
      userId: 'owner-1',
      householdId: 'household-1',
      todoEntityId: 'todo.courses',
      todoEntityName: 'Courses',
    })
    assert.isTrue(result.ok)
    if (result.ok) {
      assert.equal(result.value.todoEntityId, 'todo.courses')
      assert.equal(result.value.todoEntityName, 'Courses')
    }
  })

  test('changes direction and enabled independently', async ({ assert }) => {
    const useCase = new BindHomeAssistantList(await seededLinks(), new FakeHouseholdRepository([ownerHousehold()]), FIXED_CLOCK)
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1', direction: 'push', enabled: false })
    assert.isTrue(result.ok)
    if (result.ok) {
      assert.equal(result.value.direction.value, 'push')
      assert.isFalse(result.value.enabled)
    }
  })

  test('rejects an invalid direction', async ({ assert }) => {
    const useCase = new BindHomeAssistantList(await seededLinks(), new FakeHouseholdRepository([ownerHousehold()]), FIXED_CLOCK)
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1', direction: 'sideways' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'invalid_direction')
  })
})
```

- [ ] **Step 2: Write the failing tests for `UnlinkHomeAssistant`**

```ts
// backend/tests/unit/application/home-assistant/unlink-home-assistant.use-case.spec.ts
import { test } from '@japa/runner'
import { UnlinkHomeAssistant } from '#application/home-assistant/unlink-home-assistant.use-case'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import { FakeHomeAssistantLinkRepository, FakeHouseholdRepository, FakeShoppingItemRepository } from './fakes.js'

function ownerHousehold(): Household {
  const invite = InviteCode.create('ZZ999999')
  if (!invite.ok) throw new Error('bad fixture')
  return Household.create({
    id: 'household-1',
    name: 'Foyer',
    ownerId: 'owner-1',
    ownerMemberId: 'member-1',
    inviteCode: invite.value,
    createdAt: new Date(),
  })
}

test.group('UnlinkHomeAssistant', () => {
  test('rejects a non-owner', async ({ assert }) => {
    const useCase = new UnlinkHomeAssistant(
      new FakeHomeAssistantLinkRepository(),
      new FakeShoppingItemRepository(),
      new FakeHouseholdRepository([ownerHousehold()]),
    )
    const result = await useCase.execute({ userId: 'not-owner', householdId: 'household-1' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'not_owner')
  })

  test('fails with link_not_found when there is nothing to unlink', async ({ assert }) => {
    const useCase = new UnlinkHomeAssistant(
      new FakeHomeAssistantLinkRepository(),
      new FakeShoppingItemRepository(),
      new FakeHouseholdRepository([ownerHousehold()]),
    )
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1' })
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'link_not_found')
  })

  test('deletes the link and clears every item’s sync bookmark', async ({ assert }) => {
    const links = new FakeHomeAssistantLinkRepository()
    const urlResult = InstanceUrl.create('http://homeassistant.local:8123')
    const quantity = Quantity.create(1, 'pièce')
    const source = ShoppingItemSource.create('manual')
    if (!urlResult.ok || !quantity.ok || !source.ok) throw new Error('bad fixtures')
    await links.save(
      HomeAssistantLink.create({
        id: 'link-1',
        householdId: 'household-1',
        instanceUrl: urlResult.value,
        token: 'tok',
        createdAt: new Date(),
      }),
    )
    const items = new FakeShoppingItemRepository()
    const item = ShoppingItem.create({
      id: 'item-1',
      householdId: 'household-1',
      name: 'Lait',
      quantity: quantity.value,
      source: source.value,
      createdAt: new Date(),
    })
    item.markSynced('ha-uid-1', new Date())
    await items.save(item)

    const useCase = new UnlinkHomeAssistant(links, items, new FakeHouseholdRepository([ownerHousehold()]))
    const result = await useCase.execute({ userId: 'owner-1', householdId: 'household-1' })
    assert.isTrue(result.ok)
    assert.isNull(await links.find('household-1'))
    assert.isNull((await items.findById('item-1'))?.haUid)
  })
})
```

- [ ] **Step 3: Run to verify both fail**

Run: `cd backend && node ace test --files "tests/unit/application/home-assistant/{bind,unlink}*.spec.ts"`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `BindHomeAssistantList`**

```ts
// backend/src/application/home-assistant/bind-home-assistant-list.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import type { Clock } from '#domain/shared/clock.interface'
import { SyncDirection } from '#domain/home-assistant/sync-direction.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface BindHomeAssistantListInput {
  userId: string
  householdId: string
  todoEntityId?: string
  todoEntityName?: string
  direction?: string
  enabled?: boolean
}

export type BindHomeAssistantListError = 'not_owner' | 'link_not_found' | 'invalid_direction'

export class BindHomeAssistantList
  implements UseCase<BindHomeAssistantListInput, ResultType<HomeAssistantLink, BindHomeAssistantListError>>
{
  constructor(
    private readonly links: HomeAssistantLinkRepository,
    private readonly households: HouseholdRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: BindHomeAssistantListInput,
  ): Promise<ResultType<HomeAssistantLink, BindHomeAssistantListError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household || household.ownerId !== input.userId) return Result.err('not_owner')

    const link = await this.links.find(input.householdId)
    if (!link) return Result.err('link_not_found')

    const now = this.clock.now()

    if (input.todoEntityId !== undefined) {
      link.bindList(input.todoEntityId, input.todoEntityName ?? input.todoEntityId, now)
    }
    if (input.direction !== undefined) {
      const direction = SyncDirection.create(input.direction)
      if (!direction.ok) return Result.err('invalid_direction')
      link.changeDirection(direction.value, now)
    }
    if (input.enabled !== undefined) {
      link.setEnabled(input.enabled, now)
    }

    await this.links.save(link)
    return Result.ok(link)
  }
}
```

- [ ] **Step 5: Implement `UnlinkHomeAssistant`**

```ts
// backend/src/application/home-assistant/unlink-home-assistant.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface UnlinkHomeAssistantInput {
  userId: string
  householdId: string
}

export type UnlinkHomeAssistantError = 'not_owner' | 'link_not_found'

export class UnlinkHomeAssistant
  implements UseCase<UnlinkHomeAssistantInput, ResultType<void, UnlinkHomeAssistantError>>
{
  constructor(
    private readonly links: HomeAssistantLinkRepository,
    private readonly items: ShoppingItemRepository,
    private readonly households: HouseholdRepository,
  ) {}

  async execute(input: UnlinkHomeAssistantInput): Promise<ResultType<void, UnlinkHomeAssistantError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household || household.ownerId !== input.userId) return Result.err('not_owner')

    const link = await this.links.find(input.householdId)
    if (!link) return Result.err('link_not_found')

    await this.links.delete(input.householdId)
    await this.items.clearHomeAssistantSync(input.householdId)
    return Result.ok(undefined)
  }
}
```

- [ ] **Step 6: Run to verify both pass**

Run: `cd backend && node ace test --files "tests/unit/application/home-assistant/{bind,unlink}*.spec.ts"`
Expected: PASS, all tests.

- [ ] **Step 7: Typecheck**

Run: `cd backend && pnpm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/application/home-assistant/bind-home-assistant-list.use-case.ts backend/src/application/home-assistant/unlink-home-assistant.use-case.ts backend/tests/unit/application/home-assistant
git commit -m "feat(backend): add the bind and unlink Home Assistant use cases"
```

---

## Task 12: `SyncShoppingList` — the reconcile

**Files:**
- Create: `backend/src/application/home-assistant/sync-shopping-list.use-case.ts`
- Test: `backend/tests/unit/application/home-assistant/sync-shopping-list.use-case.spec.ts`

**Interfaces:**
- Consumes: `HomeAssistantLinkRepository`, `ShoppingItemRepository`, `HomeAssistantClient`, `IdGenerator`, `Clock`, `ShoppingItem` (its `haUid`/`haSyncedAt`/`markSynced`/`adoptFromHomeAssistant` from Task 5), `TodoItem` (Task 4).
- Produces: `SyncShoppingList` (`UseCase<{ householdId }, Result<{ synced: boolean }, string>>`), consumed by the controller (Task 13).

This is the design's core mechanism (spec §4). Read that section again before writing this file — the matrix below is not optional detail, it's the whole use case.

- [ ] **Step 1: Extend the shared fakes**

The `FakeHomeAssistantClient` from Task 10 needs to support recording calls and returning per-call results for this use case's tests. Append to `backend/tests/unit/application/home-assistant/fakes.ts`:

```ts
export class RecordingHomeAssistantClient implements HomeAssistantClient {
  calls: Array<{ method: string; args: unknown[] }> = []
  constructor(private readonly items: TodoItem[] = []) {}

  async ping() {
    return Result.ok(undefined)
  }
  async listTodoEntities() {
    return Result.ok([])
  }
  async listItems() {
    this.calls.push({ method: 'listItems', args: [] })
    return Result.ok(this.items)
  }
  async addItem(...args: unknown[]) {
    this.calls.push({ method: 'addItem', args })
    return Result.ok(undefined)
  }
  async updateItem(...args: unknown[]) {
    this.calls.push({ method: 'updateItem', args })
    return Result.ok(undefined)
  }
  async removeItem(...args: unknown[]) {
    this.calls.push({ method: 'removeItem', args })
    return Result.ok(undefined)
  }
}

export class FailingListItemsClient implements HomeAssistantClient {
  async ping() {
    return Result.ok(undefined)
  }
  async listTodoEntities() {
    return Result.ok([])
  }
  async listItems() {
    return Result.err('unreachable' as const)
  }
  async addItem() {
    return Result.ok(undefined)
  }
  async updateItem() {
    return Result.ok(undefined)
  }
  async removeItem() {
    return Result.ok(undefined)
  }
}
```

- [ ] **Step 2: Write the failing tests — one per matrix cell that has distinct logic**

```ts
// backend/tests/unit/application/home-assistant/sync-shopping-list.use-case.spec.ts
import { test } from '@japa/runner'
import { SyncShoppingList } from '#application/home-assistant/sync-shopping-list.use-case'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { SyncDirection } from '#domain/home-assistant/sync-direction.vo'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import {
  FakeHomeAssistantLinkRepository,
  FakeShoppingItemRepository,
  RecordingHomeAssistantClient,
  FailingListItemsClient,
  FIXED_CLOCK,
  SEQUENTIAL_IDS,
} from './fakes.js'

function url() {
  const result = InstanceUrl.create('http://homeassistant.local:8123')
  if (!result.ok) throw new Error('bad fixture')
  return result.value
}

async function linkedRepo(direction: 'push' | 'pull' | 'two_way', entityId = 'todo.courses') {
  const links = new FakeHomeAssistantLinkRepository()
  const link = HomeAssistantLink.create({
    id: 'link-1',
    householdId: 'household-1',
    instanceUrl: url(),
    token: 'tok',
    createdAt: new Date(),
  })
  link.bindList(entityId, 'Courses', new Date())
  const directionResult = SyncDirection.create(direction)
  if (!directionResult.ok) throw new Error('bad fixture')
  link.changeDirection(directionResult.value, new Date())
  await links.save(link)
  return links
}

function localItem(overrides: { id?: string; name?: string; haUid?: string | null; dirty?: boolean } = {}) {
  const quantity = Quantity.create(1, 'pièce')
  const source = ShoppingItemSource.create('manual')
  if (!quantity.ok || !source.ok) throw new Error('bad fixture')
  const createdAt = new Date('2026-09-01T00:00:00.000Z')
  const item = ShoppingItem.create({
    id: overrides.id ?? 'item-1',
    householdId: 'household-1',
    name: overrides.name ?? 'Lait',
    quantity: quantity.value,
    source: source.value,
    createdAt,
  })
  if (overrides.haUid !== undefined && !overrides.dirty) {
    item.markSynced(overrides.haUid, new Date('2026-09-02T00:00:00.000Z')) // synced after creation → clean
  } else if (overrides.haUid !== undefined && overrides.dirty) {
    item.markSynced(overrides.haUid, new Date('2026-08-31T00:00:00.000Z')) // synced before an edit
    item.update({ name: item.name }, new Date('2026-09-03T00:00:00.000Z')) // bumps updatedAt past haSyncedAt
  }
  return item
}

test.group('SyncShoppingList', () => {
  test('no-op when no link is configured', async ({ assert }) => {
    const useCase = new SyncShoppingList(
      new FakeHomeAssistantLinkRepository(),
      new FakeShoppingItemRepository(),
      new RecordingHomeAssistantClient(),
      SEQUENTIAL_IDS('item'),
      FIXED_CLOCK,
    )
    const result = await useCase.execute({ householdId: 'household-1' })
    assert.isTrue(result.ok)
    if (result.ok) assert.isFalse(result.value.synced)
  })

  test('no-op when the link has no bound list yet', async ({ assert }) => {
    const links = new FakeHomeAssistantLinkRepository()
    await links.save(
      HomeAssistantLink.create({
        id: 'link-1',
        householdId: 'household-1',
        instanceUrl: url(),
        token: 'tok',
        createdAt: new Date(),
      }),
    )
    const client = new RecordingHomeAssistantClient()
    const result = await new SyncShoppingList(
      links,
      new FakeShoppingItemRepository(),
      client,
      SEQUENTIAL_IDS('item'),
      FIXED_CLOCK,
    ).execute({ householdId: 'household-1' })
    assert.isTrue(result.ok)
    assert.lengthOf(client.calls, 0)
  })

  test('push: a dirty item with a known uid gets update_item', async ({ assert }) => {
    const links = await linkedRepo('push')
    const items = new FakeShoppingItemRepository()
    const item = localItem({ haUid: 'ha-1', dirty: true })
    await items.save(item)
    const client = new RecordingHomeAssistantClient([{ uid: 'ha-1', summary: 'Lait', description: null, status: 'needs_action' }])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({ householdId: 'household-1' })

    assert.isTrue(client.calls.some((c) => c.method === 'updateItem'))
  })

  test('push: a clean item with a known uid still gets update_item (push always overwrites HA)', async ({ assert }) => {
    const links = await linkedRepo('push')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ haUid: 'ha-1', dirty: false }))
    const client = new RecordingHomeAssistantClient([{ uid: 'ha-1', summary: 'Lait', description: null, status: 'needs_action' }])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({ householdId: 'household-1' })

    assert.isTrue(client.calls.some((c) => c.method === 'updateItem'))
  })

  test('push: an item whose uid vanished from HA is re-added, not left gone', async ({ assert }) => {
    const links = await linkedRepo('push')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ haUid: 'ha-gone', dirty: false }))
    const client = new RecordingHomeAssistantClient([]) // HA has nothing

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({ householdId: 'household-1' })

    assert.isTrue(client.calls.some((c) => c.method === 'addItem'))
    const reread = await items.findById('item-1')
    assert.isNull(reread?.haUid) // cleared, re-adopted by name next pass
  })

  test('push: never removes an HA item it does not own', async ({ assert }) => {
    const links = await linkedRepo('push')
    const items = new FakeShoppingItemRepository()
    const client = new RecordingHomeAssistantClient([
      { uid: 'foreign-1', summary: 'Something from a voice assistant', description: null, status: 'needs_action' },
    ])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({ householdId: 'household-1' })

    assert.isFalse(client.calls.some((c) => c.method === 'removeItem'))
  })

  test('pull: a dirty local item gets overwritten from HA, not pushed', async ({ assert }) => {
    const links = await linkedRepo('pull')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ haUid: 'ha-1', dirty: true, name: 'Lait (local edit)' }))
    const client = new RecordingHomeAssistantClient([
      { uid: 'ha-1', summary: 'Lait entier', description: '2 L', status: 'completed' },
    ])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({ householdId: 'household-1' })

    assert.isFalse(client.calls.some((c) => c.method === 'updateItem'))
    const reread = await items.findById('item-1')
    assert.equal(reread?.name, 'Lait entier')
    assert.isTrue(reread?.checked)
  })

  test('pull: an item whose uid vanished from HA is deleted locally', async ({ assert }) => {
    const links = await linkedRepo('pull')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ haUid: 'ha-gone', dirty: false }))
    const client = new RecordingHomeAssistantClient([])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({ householdId: 'household-1' })

    assert.isNull(await items.findById('item-1'))
  })

  test('pull: an HA item nobody owns locally is imported', async ({ assert }) => {
    const links = await linkedRepo('pull')
    const items = new FakeShoppingItemRepository()
    const client = new RecordingHomeAssistantClient([
      { uid: 'ha-new', summary: 'Pain', description: '1 pièce', status: 'needs_action' },
    ])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({ householdId: 'household-1' })

    const imported = await items.findByHousehold('household-1')
    assert.lengthOf(imported, 1)
    assert.equal(imported[0].name, 'Pain')
    assert.equal(imported[0].haUid, 'ha-new')
  })

  test('pull: a local-only item with no HA match is left alone, never pushed', async ({ assert }) => {
    const links = await linkedRepo('pull')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ name: 'Only here' }))
    const client = new RecordingHomeAssistantClient([])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({ householdId: 'household-1' })

    assert.isFalse(client.calls.some((c) => c.method === 'addItem'))
    assert.isNotNull(await items.findById('item-1'))
  })

  test('two_way: a brand-new local item with no uid and no HA match is added to HA', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ name: 'Nouveau' }))
    const client = new RecordingHomeAssistantClient([])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({ householdId: 'household-1' })

    assert.isTrue(client.calls.some((c) => c.method === 'addItem'))
  })

  test('two_way: a no-uid local item and a same-named HA item adopt the uid, without pushing or overwriting', async ({
    assert,
  }) => {
    const links = await linkedRepo('two_way')
    const items = new FakeShoppingItemRepository()
    await items.save(localItem({ name: 'Lait' }))
    const client = new RecordingHomeAssistantClient([
      { uid: 'ha-existing', summary: 'lait', description: null, status: 'needs_action' }, // case-insensitive match
    ])

    await new SyncShoppingList(links, items, client, SEQUENTIAL_IDS('item'), FIXED_CLOCK).execute({ householdId: 'household-1' })

    const reread = await items.findById('item-1')
    assert.equal(reread?.haUid, 'ha-existing')
    assert.isFalse(client.calls.some((c) => c.method === 'addItem'))
    assert.isFalse(client.calls.some((c) => c.method === 'updateItem'))
  })

  test('a client failure aborts the reconcile and records the failure on the link', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const items = new FakeShoppingItemRepository()
    const result = await new SyncShoppingList(
      links,
      items,
      new FailingListItemsClient(),
      SEQUENTIAL_IDS('item'),
      FIXED_CLOCK,
    ).execute({ householdId: 'household-1' })

    assert.isFalse(result.ok)
    const link = await links.find('household-1')
    assert.equal(link?.lastError, 'unreachable')
  })

  test('a successful sync clears any previous error and stamps lastSyncAt', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const link = await links.find('household-1')
    link?.recordFailure('previous failure', new Date())
    if (link) await links.save(link)

    const items = new FakeShoppingItemRepository()
    await new SyncShoppingList(
      links,
      items,
      new RecordingHomeAssistantClient([]),
      SEQUENTIAL_IDS('item'),
      FIXED_CLOCK,
    ).execute({ householdId: 'household-1' })

    const reread = await links.find('household-1')
    assert.isNull(reread?.lastError)
    assert.isNotNull(reread?.lastSyncAt)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && node ace test --files tests/unit/application/home-assistant/sync-shopping-list.use-case.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
// backend/src/application/home-assistant/sync-shopping-list.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { HomeAssistantClient, HomeAssistantConnection } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import type { TodoItem } from '#domain/home-assistant/todo-item'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface SyncShoppingListInput {
  householdId: string
}

export interface SyncShoppingListSummary {
  synced: boolean
}

/**
 * The reconcile (design §4). Home Assistant's `todo` items carry no
 * timestamp, so "dirty" is `item.haSyncedAt === null || item.updatedAt >
 * item.haSyncedAt` — never a comparison against anything on the HA side.
 *
 * Four passes, in order, because each depends on the previous one's result:
 * 1. items whose uid is already known — the ordinary push/pull/two_way rules
 * 2. adopt a uid by matching name, for local items that don't have one yet
 * 3. local items still without a uid after (2): push a brand-new HA item
 * 4. HA items nobody local claimed: import, unless direction is `push`
 */
export class SyncShoppingList
  implements UseCase<SyncShoppingListInput, ResultType<SyncShoppingListSummary, string>>
{
  constructor(
    private readonly links: HomeAssistantLinkRepository,
    private readonly items: ShoppingItemRepository,
    private readonly client: HomeAssistantClient,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: SyncShoppingListInput): Promise<ResultType<SyncShoppingListSummary, string>> {
    const link = await this.links.find(input.householdId)
    if (!link || !link.enabled || !link.todoEntityId) {
      return Result.ok({ synced: false })
    }

    const entityId = link.todoEntityId
    const connection: HomeAssistantConnection = { instanceUrl: link.instanceUrl.value, token: link.token }
    const now = this.clock.now()

    const haItemsResult = await this.client.listItems(connection, entityId)
    if (!haItemsResult.ok) {
      link.recordFailure(haItemsResult.error, now)
      await this.links.save(link)
      return Result.err(haItemsResult.error)
    }

    const haById = new Map(haItemsResult.value.map((item) => [item.uid, item]))
    const claimed = new Set<string>()
    const localItems = await this.items.findByHousehold(input.householdId)

    try {
      await this.reconcileKnownUids(connection, entityId, link.direction.value, localItems, haById, claimed, now)
      await this.adoptUidsByName(haItemsResult.value, localItems, claimed, now)

      if (link.direction.value !== 'pull') {
        for (const item of localItems) {
          if (item.haUid) continue // already known, or just adopted above
          await this.push(connection, entityId, item)
        }
      }

      if (link.direction.value !== 'push') {
        for (const haItem of haItemsResult.value) {
          if (claimed.has(haItem.uid)) continue
          await this.importFromHomeAssistant(input.householdId, haItem, now)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      link.recordFailure(message, now)
      await this.links.save(link)
      return Result.err(message)
    }

    link.recordSync(now)
    await this.links.save(link)
    return Result.ok({ synced: true })
  }

  private async reconcileKnownUids(
    connection: HomeAssistantConnection,
    entityId: string,
    direction: 'push' | 'pull' | 'two_way',
    localItems: ShoppingItem[],
    haById: Map<string, TodoItem>,
    claimed: Set<string>,
    now: Date,
  ): Promise<void> {
    for (const item of localItems) {
      const uid = item.haUid
      if (!uid) continue
      const haItem = haById.get(uid)

      if (!haItem) {
        if (direction === 'push') {
          await this.push(connection, entityId, item)
          item.markSynced(null, now) // add_item returns no uid — re-adopted by name next pass
          await this.items.save(item)
        } else {
          await this.items.delete(item.id)
        }
        continue
      }

      claimed.add(uid)
      const dirty = item.haSyncedAt === null || item.updatedAt > item.haSyncedAt

      if (direction === 'push' || (direction === 'two_way' && dirty)) {
        await this.push(connection, entityId, item)
        item.markSynced(uid, now)
        await this.items.save(item)
      } else {
        this.adopt(item, haItem, now)
        await this.items.save(item)
      }
    }
  }

  private async adoptUidsByName(
    haItems: TodoItem[],
    localItems: ShoppingItem[],
    claimed: Set<string>,
    now: Date,
  ): Promise<void> {
    const unclaimedHaItems = haItems.filter((h) => !claimed.has(h.uid))
    for (const item of localItems) {
      if (item.haUid) continue
      const match = unclaimedHaItems.find(
        (h) => !claimed.has(h.uid) && normalizeName(h.summary) === normalizeName(item.name),
      )
      if (!match) continue
      claimed.add(match.uid)
      item.markSynced(match.uid, now)
      await this.items.save(item)
    }
  }

  private async importFromHomeAssistant(householdId: string, haItem: TodoItem, now: Date): Promise<void> {
    const sourceResult = ShoppingItemSource.create('manual')
    if (!sourceResult.ok) throw new Error('unreachable: "manual" is always a valid shopping item source')

    const created = ShoppingItem.create({
      id: this.idGenerator.next(),
      householdId,
      name: haItem.summary,
      quantity: parseQuantity(haItem.description),
      source: sourceResult.value,
      createdAt: now,
    })
    if (haItem.status === 'completed') created.toggle(now)
    created.markSynced(haItem.uid, now)
    await this.items.save(created)
  }

  private async push(connection: HomeAssistantConnection, entityId: string, item: ShoppingItem): Promise<void> {
    const patch = {
      summary: item.name,
      description: formatQuantity(item.quantity),
      status: item.checked ? ('completed' as const) : ('needs_action' as const),
    }
    if (item.haUid) {
      const result = await this.client.updateItem(connection, entityId, item.haUid, patch)
      if (!result.ok) throw new Error(result.error)
    } else {
      const result = await this.client.addItem(connection, entityId, {
        summary: patch.summary,
        description: patch.description,
      })
      if (!result.ok) throw new Error(result.error)
    }
  }

  private adopt(item: ShoppingItem, haItem: TodoItem, now: Date): void {
    item.adoptFromHomeAssistant(
      { name: haItem.summary, checked: haItem.status === 'completed', quantity: parseQuantity(haItem.description) },
      haItem.uid,
      now,
    )
  }
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function formatQuantity(quantity: Quantity): string {
  return `${quantity.amount} ${quantity.unit}`
}

/** `description` is Home Assistant's free-text field — best-effort parse of
 * "<amount> <unit>"; anything else (or no description at all) falls back to
 * a default quantity rather than failing the import (design §4). */
function parseQuantity(description: string | null): Quantity {
  const match = description?.trim().match(/^(\d+)\s+(.+)$/)
  if (match) {
    const parsed = Quantity.create(Number(match[1]), match[2])
    if (parsed.ok) return parsed.value
  }
  const fallback = Quantity.create(1, 'pièce')
  if (!fallback.ok) throw new Error('unreachable: default quantity is always valid')
  return fallback.value
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && node ace test --files tests/unit/application/home-assistant/sync-shopping-list.use-case.spec.ts`
Expected: PASS, all 15 tests.

- [ ] **Step 6: Typecheck and boundary-lint**

Run: `cd backend && pnpm run typecheck && pnpm run boundaries`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/application/home-assistant/sync-shopping-list.use-case.ts backend/tests/unit/application/home-assistant/sync-shopping-list.use-case.spec.ts backend/tests/unit/application/home-assistant/fakes.ts
git commit -m "feat(backend): add the shopping-list reconcile use case"
```

---

## Task 13: `ShoppingListMirror` service

**Files:**
- Create: `backend/src/application/home-assistant/shopping-list-mirror.ts`
- Test: `backend/tests/unit/application/home-assistant/shopping-list-mirror.spec.ts`

**Interfaces:**
- Consumes: `HomeAssistantLinkRepository`, `HomeAssistantClient`, `HostPolicy`, `Clock`, `ShoppingItem`.
- Produces: `ShoppingListMirror` (not a `UseCase` — see Global Constraints) with `itemCreated(item)`, `itemUpdated(item)`, `itemDeleted(householdId, haUid)`, all `Promise<void>`, never throwing. Consumed by Task 15 (wiring into `shopping-item.controller.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// backend/tests/unit/application/home-assistant/shopping-list-mirror.spec.ts
import { test } from '@japa/runner'
import { ShoppingListMirror } from '#application/home-assistant/shopping-list-mirror'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { SyncDirection } from '#domain/home-assistant/sync-direction.vo'
import { Quantity } from '#domain/fridge/quantity.vo'
import { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import { ShoppingItemSource } from '#domain/shopping-list/shopping-item-source.vo'
import { FakeHomeAssistantLinkRepository, RecordingHomeAssistantClient, FakeHostPolicy, FIXED_CLOCK } from './fakes.js'

function url() {
  const result = InstanceUrl.create('http://homeassistant.local:8123')
  if (!result.ok) throw new Error('bad fixture')
  return result.value
}

async function linkedRepo(direction: 'push' | 'pull' | 'two_way') {
  const links = new FakeHomeAssistantLinkRepository()
  const link = HomeAssistantLink.create({
    id: 'link-1',
    householdId: 'household-1',
    instanceUrl: url(),
    token: 'tok',
    createdAt: new Date(),
  })
  link.bindList('todo.courses', 'Courses', new Date())
  const directionResult = SyncDirection.create(direction)
  if (!directionResult.ok) throw new Error('bad fixture')
  link.changeDirection(directionResult.value, new Date())
  await links.save(link)
  return links
}

function item() {
  const quantity = Quantity.create(1, 'pièce')
  const source = ShoppingItemSource.create('manual')
  if (!quantity.ok || !source.ok) throw new Error('bad fixture')
  return ShoppingItem.create({
    id: 'item-1',
    householdId: 'household-1',
    name: 'Lait',
    quantity: quantity.value,
    source: source.value,
    createdAt: new Date(),
  })
}

test.group('ShoppingListMirror', () => {
  test('itemCreated() is a no-op with no link configured', async ({ assert }) => {
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(new FakeHomeAssistantLinkRepository(), client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemCreated(item())
    assert.lengthOf(client.calls, 0)
  })

  test('itemCreated() calls addItem when linked two_way', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemCreated(item())
    assert.isTrue(client.calls.some((c) => c.method === 'addItem'))
  })

  test('itemCreated() is a no-op in pull mode — a local write must never reach HA', async ({ assert }) => {
    const links = await linkedRepo('pull')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemCreated(item())
    assert.lengthOf(client.calls, 0)
  })

  test('itemUpdated() is a no-op when the item has no known uid yet', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemUpdated(item())
    assert.lengthOf(client.calls, 0)
  })

  test('itemUpdated() calls updateItem when the item has a uid', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    const withUid = item()
    withUid.markSynced('ha-1', new Date())
    await mirror.itemUpdated(withUid)
    assert.isTrue(client.calls.some((c) => c.method === 'updateItem'))
  })

  test('itemDeleted() is a no-op with no uid (never synced yet)', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemDeleted('household-1', null)
    assert.lengthOf(client.calls, 0)
  })

  test('itemDeleted() calls removeItem with a known uid', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemDeleted('household-1', 'ha-1')
    assert.isTrue(client.calls.some((c) => c.method === 'removeItem'))
  })

  test('a client failure is swallowed and recorded on the link, never thrown', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const failing = { ...new RecordingHomeAssistantClient(), addItem: async () => ({ ok: false as const, error: 'unreachable' as const }) }
    const mirror = new ShoppingListMirror(links, failing, new FakeHostPolicy(), FIXED_CLOCK)
    await mirror.itemCreated(item()) // must not throw
    const link = await links.find('household-1')
    assert.equal(link?.lastError, 'unreachable')
  })

  test('is a no-op when the host is not on the allowlist', async ({ assert }) => {
    const links = await linkedRepo('two_way')
    const client = new RecordingHomeAssistantClient()
    const mirror = new ShoppingListMirror(links, client, new FakeHostPolicy(false), FIXED_CLOCK)
    await mirror.itemCreated(item())
    assert.lengthOf(client.calls, 0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && node ace test --files tests/unit/application/home-assistant/shopping-list-mirror.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/application/home-assistant/shopping-list-mirror.ts
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantClient, HomeAssistantConnection } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { ShoppingItem } from '#domain/shopping-list/shopping-item.entity'
import type { Clock } from '#domain/shared/clock.interface'

const MIRROR_TIMEOUT_MS = 2000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('mirror timeout')), ms)),
  ])
}

/**
 * Write-through to Home Assistant (design §5). Deliberately not a `UseCase`
 * (see Global Constraints): no single `execute`, nothing for a caller to
 * act on, and it swallows its own errors — the shopping-item write it rides
 * on has already succeeded by the time this runs.
 */
export class ShoppingListMirror {
  constructor(
    private readonly links: HomeAssistantLinkRepository,
    private readonly client: HomeAssistantClient,
    private readonly hostPolicy: HostPolicy,
    private readonly clock: Clock,
  ) {}

  async itemCreated(item: ShoppingItem): Promise<void> {
    await this.run(item.householdId, async (connection, entityId) => {
      const result = await withTimeout(
        this.client.addItem(connection, entityId, {
          summary: item.name,
          description: `${item.quantity.amount} ${item.quantity.unit}`,
        }),
        MIRROR_TIMEOUT_MS,
      )
      if (!result.ok) throw new Error(result.error)
    })
  }

  async itemUpdated(item: ShoppingItem): Promise<void> {
    if (!item.haUid) return // not yet adopted — the next reconcile will pick up the uid and the content both
    const haUid = item.haUid
    await this.run(item.householdId, async (connection, entityId) => {
      const result = await withTimeout(
        this.client.updateItem(connection, entityId, haUid, {
          summary: item.name,
          description: `${item.quantity.amount} ${item.quantity.unit}`,
          status: item.checked ? 'completed' : 'needs_action',
        }),
        MIRROR_TIMEOUT_MS,
      )
      if (!result.ok) throw new Error(result.error)
    })
  }

  async itemDeleted(householdId: string, haUid: string | null): Promise<void> {
    if (!haUid) return
    await this.run(householdId, async (connection, entityId) => {
      const result = await withTimeout(this.client.removeItem(connection, entityId, haUid), MIRROR_TIMEOUT_MS)
      if (!result.ok) throw new Error(result.error)
    })
  }

  private async run(
    householdId: string,
    call: (connection: HomeAssistantConnection, entityId: string) => Promise<void>,
  ): Promise<void> {
    const now = this.clock.now()
    let link
    try {
      link = await this.links.find(householdId)
    } catch {
      return // link_unreadable — nothing sane to mirror to, stay silent
    }
    if (!link || !link.enabled || !link.todoEntityId || link.direction.value === 'pull') return
    if (!this.hostPolicy.isAllowed(link.instanceUrl)) return

    try {
      await call({ instanceUrl: link.instanceUrl.value, token: link.token }, link.todoEntityId)
      link.recordSync(now)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      link.recordFailure(message, now)
    }
    await this.links.save(link)
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && node ace test --files tests/unit/application/home-assistant/shopping-list-mirror.spec.ts`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Typecheck and boundary-lint**

Run: `cd backend && pnpm run typecheck && pnpm run boundaries`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/application/home-assistant/shopping-list-mirror.ts backend/tests/unit/application/home-assistant/shopping-list-mirror.spec.ts
git commit -m "feat(backend): add the write-through shopping-list mirror"
```

---

## Task 14: HTTP surface — DTO, validator, controller, routes, provider wiring

**Files:**
- Create: `backend/src/presentation/home-assistant/ha-link.dto.ts`
- Create: `backend/src/presentation/home-assistant/ha-link.validator.ts`
- Create: `backend/src/presentation/home-assistant/ha-link.controller.ts`
- Create: `backend/src/presentation/home-assistant/ha-link.routes.ts`
- Create: `backend/providers/home_assistant_provider.ts`
- Modify: `backend/providers/shared_provider.ts` (binding was already added in Task 1 — nothing further here unless Step 1 finds it missing)
- Modify: `backend/src/presentation/shared/error-serializer.ts` (add the new error codes)
- Modify: `backend/adonisrc.ts` (register `#providers/home_assistant_provider`)
- Modify: `backend/start/routes.ts` (import the new routes file)

**Interfaces:**
- Consumes: all five use cases (Tasks 10–12) and `ShoppingListMirror` (Task 13).
- Produces: the six routes from design §6, plus a `homeAssistant.shoppingListMirror` container binding consumed by Task 15.

- [ ] **Step 1: Extend the error serializer**

Read `backend/src/presentation/shared/error-serializer.ts`, then add to `STRING_ERROR_STATUS`:

```ts
  invalid_url: 422,
  host_not_allowed: 422,
  unreachable: 422,
  unauthorized: 422,
  entity_not_found: 422,
  unexpected_response: 422,
  link_not_found: 404,
  link_unreadable: 409,
  token_required: 422,
  invalid_direction: 422,
```

and to `STRING_ERROR_MESSAGES`:

```ts
  invalid_url: "Cette adresse n'est pas valide.",
  host_not_allowed: "Cet hôte n'est pas autorisé sur ce serveur.",
  unreachable: 'Impossible de joindre cette adresse depuis le serveur.',
  unauthorized: 'Home Assistant a refusé ce jeton.',
  entity_not_found: 'Entité introuvable sur cette instance.',
  unexpected_response: 'Home Assistant a répondu de façon inattendue.',
  link_not_found: 'Aucune connexion Home Assistant configurée.',
  link_unreadable: 'La connexion enregistrée est illisible — reconfigurez-la.',
  token_required: 'Un jeton est requis pour la première connexion.',
  invalid_direction: 'Sens de synchronisation invalide.',
```

- [ ] **Step 2: Write the DTO**

```ts
// backend/src/presentation/home-assistant/ha-link.dto.ts
import type { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'

export interface HomeAssistantLinkDto {
  configured: boolean
  instanceUrl: string | null
  tokenSet: boolean
  todoEntityId: string | null
  todoEntityName: string | null
  direction: 'push' | 'pull' | 'two_way'
  enabled: boolean
  lastSyncAt: string | null
  lastError: string | null
}

export function toHomeAssistantLinkDto(link: HomeAssistantLink | null): HomeAssistantLinkDto {
  if (!link) {
    return {
      configured: false,
      instanceUrl: null,
      tokenSet: false,
      todoEntityId: null,
      todoEntityName: null,
      direction: 'two_way',
      enabled: true,
      lastSyncAt: null,
      lastError: null,
    }
  }
  return {
    configured: true,
    instanceUrl: link.instanceUrl.value,
    tokenSet: true,
    todoEntityId: link.todoEntityId,
    todoEntityName: link.todoEntityName,
    direction: link.direction.value,
    enabled: link.enabled,
    lastSyncAt: link.lastSyncAt ? link.lastSyncAt.toISOString() : null,
    lastError: link.lastError,
  }
}
```

- [ ] **Step 3: Write the validator**

```ts
// backend/src/presentation/home-assistant/ha-link.validator.ts
import vine from '@vinejs/vine'

export const saveHomeAssistantConnectionValidator = vine.compile(
  vine.object({
    instanceUrl: vine.string().trim(),
    token: vine.string().trim(),
  }),
)

export const discoverTodoEntitiesValidator = vine.compile(
  vine.object({
    instanceUrl: vine.string().trim().optional(),
    token: vine.string().trim().optional(),
  }),
)

export const bindHomeAssistantListValidator = vine.compile(
  vine.object({
    todoEntityId: vine.string().trim().optional(),
    todoEntityName: vine.string().trim().optional(),
    direction: vine.enum(['push', 'pull', 'two_way'] as const).optional(),
    enabled: vine.boolean().optional(),
  }),
)
```

- [ ] **Step 4: Write the controller**

```ts
// backend/src/presentation/home-assistant/ha-link.controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
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
    const links = await ctx.containerResolver.make('homeAssistant.links')
    const result = await new GetHomeAssistantLink(links).execute({ householdId: ctx.household.id })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json(toHomeAssistantLinkDto(result.value))
  }

  async update(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
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
      token: payload.token,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json(toHomeAssistantLinkDto(result.value))
  }

  async discover(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ entities: result.value })
  }

  async bind(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json(toHomeAssistantLinkDto(result.value))
  }

  async destroy(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    const links = await ctx.containerResolver.make('homeAssistant.links')
    const items = await ctx.containerResolver.make('shoppingList.items')
    const households = await ctx.containerResolver.make('identity.households')

    const result = await new UnlinkHomeAssistant(links, items, households).execute({
      userId: user.id,
      householdId: ctx.household.id,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(204).send('')
  }

  async sync(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json(result.value)
  }
}
```

- [ ] **Step 5: Write the routes**

```ts
// backend/src/presentation/home-assistant/ha-link.routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const HaLinkController = () => import('./ha-link.controller.js')

router
  .group(() => {
    router.get('/settings/home-assistant', [HaLinkController, 'show'])
    router.put('/settings/home-assistant', [HaLinkController, 'update'])
    router.post('/settings/home-assistant/discover', [HaLinkController, 'discover'])
    router.patch('/settings/home-assistant', [HaLinkController, 'bind'])
    router.delete('/settings/home-assistant', [HaLinkController, 'destroy'])
    // Path lives under /api/shopping-items because that is what's being
    // synced, but this code belongs to the home-assistant context —
    // shopping-list stays unaware it is mirrored (design §6).
    router.post('/shopping-items/sync', [HaLinkController, 'sync'])
  })
  .prefix('/api')
  .use([middleware.householdRequired()])
```

- [ ] **Step 6: Register the routes file**

In `backend/start/routes.ts`, add:

```ts
import '#presentation/home-assistant/ha-link.routes'
```

- [ ] **Step 7: Write the provider**

```ts
// backend/providers/home_assistant_provider.ts
import type { ApplicationService } from '@adonisjs/core/types'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantClient } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { ShoppingListMirror } from '#application/home-assistant/shopping-list-mirror'

export default class HomeAssistantProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('homeAssistant.links', async () => {
      const { LucidHomeAssistantLinkRepository } =
        await import('#infrastructure/database/home-assistant/home-assistant-link.repository')
      const encryption = await this.app.container.make('shared.encryption')
      return new LucidHomeAssistantLinkRepository(encryption)
    })

    this.app.container.singleton('homeAssistant.client', async () => {
      const { HttpHomeAssistantClient } = await import('#infrastructure/home-assistant/http-home-assistant.client')
      return new HttpHomeAssistantClient()
    })

    this.app.container.singleton('homeAssistant.hostPolicy', async () => {
      const { EnvHostPolicy } = await import('#infrastructure/home-assistant/env-host-policy')
      return new EnvHostPolicy()
    })

    this.app.container.singleton('homeAssistant.shoppingListMirror', async () => {
      const { ShoppingListMirror } = await import('#application/home-assistant/shopping-list-mirror')
      const links = await this.app.container.make('homeAssistant.links')
      const client = await this.app.container.make('homeAssistant.client')
      const hostPolicy = await this.app.container.make('homeAssistant.hostPolicy')
      const clock = await this.app.container.make('shared.clock')
      return new ShoppingListMirror(links, client, hostPolicy, clock)
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'homeAssistant.links': HomeAssistantLinkRepository
    'homeAssistant.client': HomeAssistantClient
    'homeAssistant.hostPolicy': HostPolicy
    'homeAssistant.shoppingListMirror': ShoppingListMirror
  }
}
```

- [ ] **Step 8: Register the provider**

In `backend/adonisrc.ts`, add to the `providers` array, after `#providers/shopping_list_provider`:

```ts
    () => import('#providers/home_assistant_provider'),
```

- [ ] **Step 9: Typecheck**

Run: `cd backend && pnpm run typecheck`
Expected: no errors.

- [ ] **Step 10: Boot check**

Run: `cd backend && node ace list:routes | grep home-assistant`
Expected: all six routes listed (GET/PUT/POST discover/PATCH/DELETE under `/api/settings/home-assistant`, POST `/api/shopping-items/sync`).

- [ ] **Step 11: Commit**

```bash
git add backend/src/presentation/home-assistant backend/providers/home_assistant_provider.ts backend/src/presentation/shared/error-serializer.ts backend/adonisrc.ts backend/start/routes.ts
git commit -m "feat(backend): expose the Home Assistant link over HTTP"
```

---

## Task 15: Wire the mirror into `shopping-item.controller.ts`

**Files:**
- Modify: `backend/src/presentation/shopping-list/shopping-item.controller.ts`

**Interfaces:**
- Consumes: `homeAssistant.shoppingListMirror` container binding (Task 14).

`create-shopping-item.use-case.ts`, `update-shopping-item.use-case.ts`, `delete-shopping-item.use-case.ts` do **not** change — the mirror is composed at the controller, never inside the use case (design §5): a failed mirror is explicitly not part of the write's own contract.

- [ ] **Step 1: Read the current controller**

Run: `cat backend/src/presentation/shopping-list/shopping-item.controller.ts`

- [ ] **Step 2: Modify `store()`, `update()`, `destroy()`**

```ts
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
    const mirror = await ctx.containerResolver.make('homeAssistant.shoppingListMirror')
    await mirror.itemCreated(result.value)
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
    const mirror = await ctx.containerResolver.make('homeAssistant.shoppingListMirror')
    await mirror.itemUpdated(result.value)
    return ctx.response.json({ item: toShoppingItemDto(result.value) })
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }
    const mirror = await ctx.containerResolver.make('homeAssistant.shoppingListMirror')
    await mirror.itemDeleted(ctx.household.id, existing?.haUid ?? null)
    return ctx.response.status(204).send('')
  }
```

(Confirm `DeleteShoppingItem`'s actual return shape before writing this — if it already returns the deleted item, use that instead of the extra `findById` call; read `backend/src/application/shopping-list/delete-shopping-item.use-case.ts` first.)

- [ ] **Step 3: Run the shopping-list test suites**

Run: `cd backend && node ace test --files "tests/unit/**/shopping-list/**" --files "tests/functional/**/shopping*"`
Expected: PASS — no existing test should have broken (the mirror no-ops with no link configured, which is every existing fixture's state).

- [ ] **Step 4: Typecheck**

Run: `cd backend && pnpm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/presentation/shopping-list/shopping-item.controller.ts
git commit -m "feat(backend): write-through shopping-item writes to Home Assistant"
```

---

## Task 16: Backend functional tests

**Files:**
- Create: `backend/tests/functional/home-assistant/ha-link.spec.ts`

**Interfaces:**
- Consumes: the live route surface from Task 14.

Scoped deliberately to what needs no live Home Assistant instance: owner-gating, DTO shape, and the no-op paths. The outbound-HTTP-dependent behavior (a `PUT` that actually pings, a `discover` that actually lists entities) is already covered by the use-case unit tests in Task 10, against a fake client — there is no CI-safe way to also exercise a real Home Assistant over the network, and this codebase has no container-swap convention for string-keyed bindings to fake it at the HTTP layer either.

- [ ] **Step 1: Write the failing tests**

Read `backend/tests/functional/settings/ai-settings.spec.ts` first to copy its exact `signUp()` helper and `db.beginGlobalTransaction()` setup/teardown shape.

```ts
// backend/tests/functional/home-assistant/ha-link.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

async function signUp(client: import('@japa/api-client').ApiClient, email: string) {
  const response = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  const cookie = response.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  return cookie
}

test.group('home-assistant: /api/settings/home-assistant, /api/shopping-items/sync', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('GET reflects "not configured" before any link exists', async ({ client }) => {
    const cookie = await signUp(client, 'ha-get@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer HA' })

    const response = await client.get('/api/settings/home-assistant').headers({ cookie })
    response.assertStatus(200)
    response.assertBodyContains({ configured: false, tokenSet: false })
  })

  test('PUT is rejected for a household member who is not the owner', async ({ client }) => {
    const ownerCookie = await signUp(client, 'ha-owner-1@example.com')
    const householdResponse = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer HA' })
    const inviteCode = householdResponse.body().inviteCode

    const memberCookie = await signUp(client, 'ha-member-1@example.com')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const response = await client
      .put('/api/settings/home-assistant')
      .headers({ cookie: memberCookie })
      .json({ instanceUrl: 'http://homeassistant.local:8123', token: 'tok' })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'not_owner' } })
  })

  test('POST /discover is rejected for a non-owner', async ({ client }) => {
    const ownerCookie = await signUp(client, 'ha-owner-2@example.com')
    const householdResponse = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer HA' })
    const inviteCode = householdResponse.body().inviteCode

    const memberCookie = await signUp(client, 'ha-member-2@example.com')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const response = await client.post('/api/settings/home-assistant/discover').headers({ cookie: memberCookie }).json({})
    response.assertStatus(403)
  })

  test('PATCH is rejected for a non-owner', async ({ client }) => {
    const ownerCookie = await signUp(client, 'ha-owner-3@example.com')
    const householdResponse = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer HA' })
    const inviteCode = householdResponse.body().inviteCode

    const memberCookie = await signUp(client, 'ha-member-3@example.com')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const response = await client
      .patch('/api/settings/home-assistant')
      .headers({ cookie: memberCookie })
      .json({ enabled: false })
    response.assertStatus(403)
  })

  test('DELETE is rejected for a non-owner', async ({ client }) => {
    const ownerCookie = await signUp(client, 'ha-owner-4@example.com')
    const householdResponse = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer HA' })
    const inviteCode = householdResponse.body().inviteCode

    const memberCookie = await signUp(client, 'ha-member-4@example.com')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const response = await client.delete('/api/settings/home-assistant').headers({ cookie: memberCookie })
    response.assertStatus(403)
  })

  test('DELETE with no link configured returns 404 link_not_found', async ({ client }) => {
    const cookie = await signUp(client, 'ha-delete-none@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer HA' })

    const response = await client.delete('/api/settings/home-assistant').headers({ cookie })
    response.assertStatus(404)
    response.assertBodyContains({ error: { type: 'link_not_found' } })
  })

  test('POST /shopping-items/sync with no link configured is a no-op success', async ({ client }) => {
    const cookie = await signUp(client, 'ha-sync-none@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer HA' })

    const response = await client.post('/api/shopping-items/sync').headers({ cookie })
    response.assertStatus(200)
    response.assertBodyContains({ synced: false })
  })

  test('every route 401s with no session', async ({ client }) => {
    ;(await client.get('/api/settings/home-assistant')).assertStatus(401)
    ;(await client.put('/api/settings/home-assistant').json({})).assertStatus(401)
    ;(await client.post('/api/settings/home-assistant/discover').json({})).assertStatus(401)
    ;(await client.patch('/api/settings/home-assistant').json({})).assertStatus(401)
    ;(await client.delete('/api/settings/home-assistant')).assertStatus(401)
    ;(await client.post('/api/shopping-items/sync')).assertStatus(401)
  })
})
```

(Adjust `/api/households/join` and its `inviteCode` body field name to whatever `household.repository.spec.ts`/`ai-settings.spec.ts` or the actual join route/validator use — read `backend/src/presentation/identity/household.routes.ts` and `household.validator.ts` if unsure, don't guess the field name.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && node ace test --files tests/functional/home-assistant/ha-link.spec.ts`
Expected: FAIL initially only if a route/field-name mismatch turns up — fix the test to match the real routes discovered in Task 14 Step 10, not the routes to match the test.

- [ ] **Step 3: Run to verify it passes**

Run: `cd backend && node ace test --files tests/functional/home-assistant/ha-link.spec.ts`
Expected: PASS, all 9 tests.

- [ ] **Step 4: Run the entire backend suite**

Run: `cd backend && pnpm run test`
Expected: PASS, nothing broken anywhere else.

- [ ] **Step 5: Full backend check**

Run: `cd backend && pnpm run lint && pnpm run typecheck && pnpm run boundaries`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/functional/home-assistant/ha-link.spec.ts
git commit -m "test(backend): add functional coverage for the Home Assistant routes"
```

This closes the backend. Tasks 17+ are mobile.

---

## Task 17: Mobile domain types + `FridgeConnector` interface additions

**Files:**
- Create: `mobile/src/domain/home-assistant/ha-link.ts`
- Modify: `mobile/src/domain/interfaces/fridge-connector.ts`

**Interfaces:**
- Produces: `HaSyncDirection = 'push' | 'pull' | 'two_way'`, `HaLink` (mirrors `HomeAssistantLinkDto` field-for-field, same convention as `AiSettings` mirroring `AiSettingsDto`), `HaTodoEntity`, six new `FridgeConnector` method signatures — consumed by Tasks 18 (both implementations) and 19 (the application layer).

- [ ] **Step 1: Write the domain types**

```ts
// mobile/src/domain/home-assistant/ha-link.ts
export type HaSyncDirection = 'push' | 'pull' | 'two_way'

/** Mirrors `HomeAssistantLinkDto` (backend) field-for-field. */
export interface HaLink {
  configured: boolean
  instanceUrl: string | null
  tokenSet: boolean
  todoEntityId: string | null
  todoEntityName: string | null
  direction: HaSyncDirection
  enabled: boolean
  lastSyncAt: string | null
  lastError: string | null
}

export interface HaTodoEntity {
  entityId: string
  friendlyName: string
}

export interface SaveHaConnectionInput {
  instanceUrl: string
  token: string
}

export interface DiscoverHaEntitiesInput {
  instanceUrl?: string
  token?: string
}

export interface BindHaListInput {
  todoEntityId?: string
  todoEntityName?: string
  direction?: HaSyncDirection
  enabled?: boolean
}
```

- [ ] **Step 2: Extend the connector interface**

Read `mobile/src/domain/interfaces/fridge-connector.ts` first, then add near the `getAiSettings`/`setActiveAiProvider` pair:

```ts
  getHaLink(): Promise<HaLink | null>
  saveHaConnection(input: SaveHaConnectionInput): Promise<Result<HaLink, ApiError>>
  discoverHaTodoEntities(input: DiscoverHaEntitiesInput): Promise<Result<HaTodoEntity[], ApiError>>
  bindHaList(input: BindHaListInput): Promise<Result<HaLink, ApiError>>
  unlinkHa(): Promise<Result<void, ApiError>>
  syncShoppingListWithHa(): Promise<Result<{ synced: boolean }, ApiError>>
```

and the import at the top:

```ts
import type {
  HaLink,
  HaTodoEntity,
  SaveHaConnectionInput,
  DiscoverHaEntitiesInput,
  BindHaListInput,
} from '../home-assistant/ha-link.js'
```

- [ ] **Step 3: Typecheck**

Run: `cd mobile && pnpm run typecheck`
Expected: FAILS — `HttpFridgeConnector` and `FakeFridgeConnector` don't implement the six new methods yet. Confirm the *only* errors are `"Class ... incorrectly implements interface"` on those two classes before moving to Task 18.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/domain/home-assistant/ha-link.ts mobile/src/domain/interfaces/fridge-connector.ts
git commit -m "feat(mobile): add the Home Assistant link domain types"
```

---

## Task 18: `HttpFridgeConnector` and `FakeFridgeConnector` implementations

**Files:**
- Modify: `mobile/src/infrastructure/http/http-fridge-connector.ts`
- Modify: `mobile/src/infrastructure/fake/fake-fridge-connector.ts`
- Create: `mobile/src/infrastructure/fake/fixtures/ha-link.fixture.ts`

**Interfaces:**
- Consumes: the six methods declared in Task 17.
- Produces: working implementations both real screens (Task 22) and tests can run against.

- [ ] **Step 1: Add the HTTP implementation**

In `mobile/src/infrastructure/http/http-fridge-connector.ts`, add near `getAiSettings`/`setActiveAiProvider`:

```ts
  async getHaLink(): Promise<HaLink | null> {
    const result = await apiFetch<HaLink>('/api/settings/home-assistant')
    return result.ok ? result.value : null
  }

  async saveHaConnection(input: SaveHaConnectionInput): Promise<Result<HaLink, ApiError>> {
    const result = await apiFetch<HaLink>('/api/settings/home-assistant', {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async discoverHaTodoEntities(input: DiscoverHaEntitiesInput): Promise<Result<HaTodoEntity[], ApiError>> {
    const result = await apiFetch<{ entities: HaTodoEntity[] }>('/api/settings/home-assistant/discover', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return result.ok ? Result.ok(result.value.entities) : Result.err(result.error)
  }

  async bindHaList(input: BindHaListInput): Promise<Result<HaLink, ApiError>> {
    const result = await apiFetch<HaLink>('/api/settings/home-assistant', {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }

  async unlinkHa(): Promise<Result<void, ApiError>> {
    const result = await apiFetch<void>('/api/settings/home-assistant', { method: 'DELETE' })
    return result.ok ? Result.ok(undefined) : Result.err(result.error)
  }

  async syncShoppingListWithHa(): Promise<Result<{ synced: boolean }, ApiError>> {
    const result = await apiFetch<{ synced: boolean }>('/api/shopping-items/sync', { method: 'POST' })
    return result.ok ? Result.ok(result.value) : Result.err(result.error)
  }
```

and the import:

```ts
import type {
  HaLink,
  HaTodoEntity,
  SaveHaConnectionInput,
  DiscoverHaEntitiesInput,
  BindHaListInput,
} from '../../domain/home-assistant/ha-link.js'
```

- [ ] **Step 2: Write the fake fixture**

```ts
// mobile/src/infrastructure/fake/fixtures/ha-link.fixture.ts
import type { HaLink } from '../../../domain/home-assistant/ha-link.js'

export const fakeUnconfiguredHaLink: HaLink = {
  configured: false,
  instanceUrl: null,
  tokenSet: false,
  todoEntityId: null,
  todoEntityName: null,
  direction: 'two_way',
  enabled: true,
  lastSyncAt: null,
  lastError: null,
}
```

- [ ] **Step 3: Add the fake implementation**

In `mobile/src/infrastructure/fake/fake-fridge-connector.ts`, add a private field near the other fake state (`private aiSettings = fakeAiSettings` or similar — read the file to match the exact style) and the six methods:

```ts
  private haLink: HaLink = { ...fakeUnconfiguredHaLink }

  async getHaLink(): Promise<HaLink | null> {
    return this.haLink
  }

  async saveHaConnection(input: SaveHaConnectionInput): Promise<Result<HaLink, ApiError>> {
    if (!input.token && !this.haLink.tokenSet) {
      return Result.err({ type: 'token_required', message: 'Un jeton est requis pour la première connexion.' })
    }
    this.haLink = { ...this.haLink, configured: true, instanceUrl: input.instanceUrl, tokenSet: true }
    return Result.ok(this.haLink)
  }

  async discoverHaTodoEntities(): Promise<Result<HaTodoEntity[], ApiError>> {
    return Result.ok([
      { entityId: 'todo.courses', friendlyName: 'Courses' },
      { entityId: 'todo.taches', friendlyName: 'Tâches' },
    ])
  }

  async bindHaList(input: BindHaListInput): Promise<Result<HaLink, ApiError>> {
    this.haLink = {
      ...this.haLink,
      todoEntityId: input.todoEntityId ?? this.haLink.todoEntityId,
      todoEntityName: input.todoEntityName ?? this.haLink.todoEntityName,
      direction: input.direction ?? this.haLink.direction,
      enabled: input.enabled ?? this.haLink.enabled,
    }
    return Result.ok(this.haLink)
  }

  async unlinkHa(): Promise<Result<void, ApiError>> {
    this.haLink = { ...fakeUnconfiguredHaLink }
    return Result.ok(undefined)
  }

  async syncShoppingListWithHa(): Promise<Result<{ synced: boolean }, ApiError>> {
    return Result.ok({ synced: this.haLink.configured && Boolean(this.haLink.todoEntityId) })
  }
```

and the imports:

```ts
import { fakeUnconfiguredHaLink } from './fixtures/ha-link.fixture.js'
import type {
  HaLink,
  HaTodoEntity,
  SaveHaConnectionInput,
  DiscoverHaEntitiesInput,
  BindHaListInput,
} from '../../domain/home-assistant/ha-link.js'
```

(`DiscoverHaEntitiesInput` is unused by the fake body above since it ignores its input — keep the import only if TypeScript needs it for the method signature; otherwise drop it to avoid an unused-import lint error.)

- [ ] **Step 4: Typecheck**

Run: `cd mobile && pnpm run typecheck`
Expected: no errors — both classes now fully implement `FridgeConnector`.

- [ ] **Step 5: Run the full mobile suite**

Run: `cd mobile && pnpm run test`
Expected: PASS — nothing existing should break (the fake's new field is additive).

- [ ] **Step 6: Commit**

```bash
git add mobile/src/infrastructure/http/http-fridge-connector.ts mobile/src/infrastructure/fake/fake-fridge-connector.ts mobile/src/infrastructure/fake/fixtures/ha-link.fixture.ts
git commit -m "feat(mobile): implement the Home Assistant connector methods"
```

---

## Task 19: Application layer — query + mutations

**Files:**
- Create: `mobile/src/application/home-assistant/ha-link.query.ts`
- Create: `mobile/src/application/home-assistant/save-ha-connection.mutation.ts`
- Create: `mobile/src/application/home-assistant/discover-ha-todo-entities.mutation.ts`
- Create: `mobile/src/application/home-assistant/bind-ha-list.mutation.ts`
- Create: `mobile/src/application/home-assistant/unlink-ha.mutation.ts`
- Create: `mobile/src/application/home-assistant/sync-shopping-list-with-ha.mutation.ts`

**Interfaces:**
- Consumes: `defineQuery`/`defineMutation` (`#application/shared`), the connector methods from Task 18.
- Produces: six hooks (`useHaLinkQuery`, `useSaveHaConnectionMutation`, `useDiscoverHaTodoEntitiesMutation`, `useBindHaListMutation`, `useUnlinkHaMutation`, `useSyncShoppingListWithHaMutation`) — consumed by Tasks 22–24.

- [ ] **Step 1: Write all six files**

```ts
// mobile/src/application/home-assistant/ha-link.query.ts
import { defineQuery } from '../shared/define-query.js'

export const useHaLinkQuery = defineQuery(['ha-link'], (connector) => connector.getHaLink())
```

```ts
// mobile/src/application/home-assistant/save-ha-connection.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'
import type { SaveHaConnectionInput } from '../../domain/home-assistant/ha-link.js'

export const useSaveHaConnectionMutation = defineMutation((connector, input: SaveHaConnectionInput) =>
  connector.saveHaConnection(input),
)
```

```ts
// mobile/src/application/home-assistant/discover-ha-todo-entities.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'
import type { DiscoverHaEntitiesInput } from '../../domain/home-assistant/ha-link.js'

export const useDiscoverHaTodoEntitiesMutation = defineMutation((connector, input: DiscoverHaEntitiesInput) =>
  connector.discoverHaTodoEntities(input),
)
```

```ts
// mobile/src/application/home-assistant/bind-ha-list.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'
import type { BindHaListInput } from '../../domain/home-assistant/ha-link.js'

export const useBindHaListMutation = defineMutation((connector, input: BindHaListInput) => connector.bindHaList(input))
```

```ts
// mobile/src/application/home-assistant/unlink-ha.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'

export const useUnlinkHaMutation = defineMutation((connector, _input: void) => connector.unlinkHa())
```

```ts
// mobile/src/application/home-assistant/sync-shopping-list-with-ha.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'

export const useSyncShoppingListWithHaMutation = defineMutation((connector, _input: void) =>
  connector.syncShoppingListWithHa(),
)
```

- [ ] **Step 2: Typecheck**

Run: `cd mobile && pnpm run typecheck`
Expected: no errors.

- [ ] **Step 3: Boundary-lint**

Run: `cd mobile && pnpm run boundaries`
Expected: no errors (these are `application/` files depending only on `domain/` + the connector interface, same as every existing file in that directory).

- [ ] **Step 4: Commit**

```bash
git add mobile/src/application/home-assistant
git commit -m "feat(mobile): add the Home Assistant query and mutation hooks"
```

---

## Task 20: Route registration — `home-assistant.tsx` as a modal

**Files:**
- Create: `mobile/src/app/home-assistant.tsx`
- Modify: `mobile/src/app/_layout.tsx`
- Modify: `mobile/src/presentation/shared/stack-routes.test.tsx`

**Interfaces:**
- Produces: the `/home-assistant` route, presented modally, reachable from the settings screen (Task 23).

This step creates the route pointing at a screen component that doesn't exist yet (Task 22 writes it) — a temporary placeholder keeps the route wired and testable in isolation; Task 22 replaces the placeholder body.

- [ ] **Step 1: Create the route file with a placeholder**

```tsx
// mobile/src/app/home-assistant.tsx
import { HomeAssistantScreen } from '../presentation/home-assistant/home-assistant-screen.js'

export default function HomeAssistantRoute() {
  return <HomeAssistantScreen />
}
```

(`HomeAssistantScreen` doesn't exist until Task 22 — this file will fail to resolve until then, which is expected and fine since Task 22 comes immediately after.)

- [ ] **Step 2: Register the modal in the root Stack**

In `mobile/src/app/_layout.tsx`, add a `<Stack.Screen>` entry alongside `settings`/`household`/`receipts`:

```tsx
              <Stack.Screen name="home-assistant" options={{ presentation: 'modal' }} />
```

- [ ] **Step 3: Extend the stack-routes regression test**

Read `mobile/src/presentation/shared/stack-routes.test.tsx` first (it's the existing regression test for pushed-screen reachability), then add `home-assistant` to its route map and its `go()` assertions:

```tsx
      'home-assistant': () => <Text>Home Assistant</Text>,
```

added to the object passed to `renderRouter(...)`, and:

```tsx
  await go(() => router.push('/home-assistant'), '/home-assistant')
```

added to the sequence of `go()` calls at the end of the test.

- [ ] **Step 4: Run to verify the test passes** (it exercises the route registration, not the real screen — the fake `<Text>` stand-in above is what's under test here, matching how the existing test stands in `settings`/`household`/`receipts` too)

Run: `cd mobile && pnpm run test -- stack-routes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/app/home-assistant.tsx mobile/src/app/_layout.tsx mobile/src/presentation/shared/stack-routes.test.tsx
git commit -m "feat(mobile): register the Home Assistant screen as a modal route"
```

---

## Task 21: `TodoEntityPicker` component

**Files:**
- Create: `mobile/src/presentation/home-assistant/todo-entity-picker.tsx`
- Test: `mobile/src/presentation/home-assistant/todo-entity-picker.test.tsx`

**Interfaces:**
- Consumes: `HaTodoEntity` (Task 17), `Text`/`XStack`/`YStack` (`../shared/tamagui-typed.js`), `useSoftPalette`/`SoftPalette` (`../dashboard/soft-palette.js`), `useHoverPress`/`pointerCursor` (`../shared/hover.js`), `ripple` (`../shared/material.js`) — the same primitives `Chip`/`ActionSheetRow` are built from.
- Produces: `TodoEntityPicker({ entities, selectedEntityId, onSelect, palette })` — a search field plus a filtered, single-select list — consumed by Task 22.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/src/presentation/home-assistant/todo-entity-picker.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../shared/theme-provider.js'
import { TodoEntityPicker } from './todo-entity-picker.js'

const entities = [
  { entityId: 'todo.courses', friendlyName: 'Courses' },
  { entityId: 'todo.taches', friendlyName: 'Tâches ménagères' },
]

function renderPicker(onSelect = jest.fn()) {
  render(
    <ThemeProvider>
      <TodoEntityPicker entities={entities} selectedEntityId={null} onSelect={onSelect} />
    </ThemeProvider>,
  )
  return onSelect
}

test('lists every entity by its friendly name', () => {
  renderPicker()
  expect(screen.getByText('Courses')).toBeTruthy()
  expect(screen.getByText('Tâches ménagères')).toBeTruthy()
})

test('filters by search text, matching the friendly name', () => {
  renderPicker()
  fireEvent.changeText(screen.getByPlaceholderText('Rechercher une liste'), 'tâches')
  expect(screen.queryByText('Courses')).toBeNull()
  expect(screen.getByText('Tâches ménagères')).toBeTruthy()
})

test('filters by search text, matching the raw entity id', () => {
  renderPicker()
  fireEvent.changeText(screen.getByPlaceholderText('Rechercher une liste'), 'todo.courses')
  expect(screen.getByText('Courses')).toBeTruthy()
  expect(screen.queryByText('Tâches ménagères')).toBeNull()
})

test('tapping a row calls onSelect with that entity id', () => {
  const onSelect = renderPicker()
  fireEvent.press(screen.getByText('Courses'))
  expect(onSelect).toHaveBeenCalledWith('todo.courses', 'Courses')
})

test('marks the selected row', () => {
  render(
    <ThemeProvider>
      <TodoEntityPicker entities={entities} selectedEntityId="todo.courses" onSelect={jest.fn()} />
    </ThemeProvider>,
  )
  const row = screen.getByTestId('todo-entity-todo.courses')
  expect(row.props.accessibilityState?.selected).toBe(true)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && pnpm run test -- todo-entity-picker`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// mobile/src/presentation/home-assistant/todo-entity-picker.tsx
import { useState } from 'react'
import { Pressable, TextInput } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { ripple } from '../shared/material.js'
import type { HaTodoEntity } from '../../domain/home-assistant/ha-link.js'

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function TodoEntityRow({
  entity,
  selected,
  onPress,
}: {
  entity: HaTodoEntity
  selected: boolean
  onPress: () => void
}) {
  const palette = useSoftPalette()
  const hover = useHoverPress()
  return (
    <Pressable
      testID={`todo-entity-${entity.entityId}`}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={entity.friendlyName}
      android_ripple={ripple(palette.ink)}
      style={pointerCursor}
    >
      <XStack
        alignItems="center"
        justifyContent="space-between"
        paddingVertical="$3"
        paddingHorizontal="$3"
        borderRadius={14}
        backgroundColor={selected ? palette.accentLime : 'transparent'}
      >
        <YStack>
          <Text fontSize={14} fontWeight="700" color={palette.ink}>
            {entity.friendlyName}
          </Text>
          <Text fontSize={12} color={palette.inkSecondary}>
            {entity.entityId}
          </Text>
        </YStack>
      </XStack>
    </Pressable>
  )
}

export function TodoEntityPicker({
  entities,
  selectedEntityId,
  onSelect,
}: {
  entities: HaTodoEntity[]
  selectedEntityId: string | null
  onSelect: (entityId: string, friendlyName: string) => void
}) {
  const palette = useSoftPalette()
  const [search, setSearch] = useState('')
  const filtered = entities.filter((entity) => {
    const query = normalize(search)
    if (!query) return true
    return normalize(entity.friendlyName).includes(query) || normalize(entity.entityId).includes(query)
  })

  return (
    <YStack gap="$2">
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher une liste"
        placeholderTextColor={palette.inkSecondary}
        accessibilityLabel="Rechercher une liste"
        style={{
          minHeight: 44,
          borderRadius: 14,
          paddingHorizontal: 16,
          fontSize: 14,
          color: palette.ink,
          backgroundColor: palette.cream,
        }}
      />
      <YStack>
        {filtered.map((entity) => (
          <TodoEntityRow
            key={entity.entityId}
            entity={entity}
            selected={entity.entityId === selectedEntityId}
            onPress={() => onSelect(entity.entityId, entity.friendlyName)}
          />
        ))}
        {filtered.length === 0 ? (
          <Text fontSize={13} color={palette.inkSecondary} paddingVertical="$2">
            Aucune liste ne correspond.
          </Text>
        ) : null}
      </YStack>
    </YStack>
  )
}
```

(If `hover.ts`/`material.ts` export different names than `useHoverPress`/`pointerCursor`/`ripple`, or `tamagui-typed.ts` doesn't export a bare `Text`/`XStack`/`YStack` the way assumed — re-check against `chip.tsx`'s actual imports, already read earlier in this plan's research, and correct the import lines to match exactly.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd mobile && pnpm run test -- todo-entity-picker`
Expected: PASS, 5 tests.

- [ ] **Step 5: Typecheck**

Run: `cd mobile && pnpm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/presentation/home-assistant/todo-entity-picker.tsx mobile/src/presentation/home-assistant/todo-entity-picker.test.tsx
git commit -m "feat(mobile): add the searchable todo-entity picker"
```

---

## Task 22: `HomeAssistantScreen` — the two-state modal

**Files:**
- Create: `mobile/src/presentation/home-assistant/home-assistant-screen.tsx`
- Test: `mobile/src/presentation/home-assistant/home-assistant-screen.test.tsx`

**Interfaces:**
- Consumes: `useHaLinkQuery`, `useSaveHaConnectionMutation`, `useDiscoverHaTodoEntitiesMutation`, `useBindHaListMutation`, `useUnlinkHaMutation` (Task 19), `TodoEntityPicker` (Task 21), `AppShell`, `ScreenHeader`, `FormCard`, `AuthField`, `Chip`, `ActionSheet`, `useSoftPalette` (all existing shared components).
- Produces: `HomeAssistantScreen` — the component `mobile/src/app/home-assistant.tsx` (Task 20) renders.

Two states, one `step` variable: `'connect'` (URL + token + test) and `'list'` (picker + direction chips + enabled toggle + last-sync line + unlink). Opening an already-configured foyer starts on `'list'`.

- [ ] **Step 1: Write the failing tests**

```tsx
// mobile/src/presentation/home-assistant/home-assistant-screen.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { HomeAssistantScreen } from './home-assistant-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useFocusEffect: jest.fn() }))

function renderScreen(connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <HomeAssistantScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('an unconfigured foyer starts on the connection form', async () => {
  renderScreen()
  await waitFor(() => expect(screen.getByPlaceholderText(/adresse/i)).toBeTruthy())
  expect(screen.queryByText('Rechercher une liste')).toBeNull()
})

test('testing the connection reveals the list picker', async () => {
  renderScreen()
  await waitFor(() => expect(screen.getByPlaceholderText(/adresse/i)).toBeTruthy())
  fireEvent.changeText(screen.getByPlaceholderText(/adresse/i), 'http://homeassistant.local:8123')
  fireEvent.changeText(screen.getByPlaceholderText(/jeton/i), 'a-token')
  fireEvent.press(screen.getByText('Tester la connexion'))
  await waitFor(() => expect(screen.getByPlaceholderText('Rechercher une liste')).toBeTruthy())
  expect(screen.getByText('Courses')).toBeTruthy() // from the fake's discoverHaTodoEntities()
})

test('picking a list and saving calls bindHaList and pops the screen', async () => {
  renderScreen()
  await waitFor(() => expect(screen.getByPlaceholderText(/adresse/i)).toBeTruthy())
  fireEvent.changeText(screen.getByPlaceholderText(/adresse/i), 'http://homeassistant.local:8123')
  fireEvent.changeText(screen.getByPlaceholderText(/jeton/i), 'a-token')
  fireEvent.press(screen.getByText('Tester la connexion'))
  await waitFor(() => expect(screen.getByText('Courses')).toBeTruthy())
  fireEvent.press(screen.getByText('Courses'))
  fireEvent.press(screen.getByText('Enregistrer'))
  await waitFor(() => expect(router.back).toHaveBeenCalled())
})

test('the direction chips default to "Deux sens" and switch on tap', async () => {
  renderScreen()
  await waitFor(() => expect(screen.getByPlaceholderText(/adresse/i)).toBeTruthy())
  fireEvent.changeText(screen.getByPlaceholderText(/adresse/i), 'http://homeassistant.local:8123')
  fireEvent.changeText(screen.getByPlaceholderText(/jeton/i), 'a-token')
  fireEvent.press(screen.getByText('Tester la connexion'))
  await waitFor(() => expect(screen.getByText('Deux sens')).toBeTruthy())
  fireEvent.press(screen.getByText('Vers Home Assistant'))
  expect(screen.getByText(/Home Assistant reflète cette liste/)).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && pnpm run test -- home-assistant-screen`
Expected: FAIL — module not found (the placeholder from Task 20 makes `home-assistant.tsx` resolve, but this test imports the screen module directly, which doesn't exist yet).

- [ ] **Step 3: Implement**

```tsx
// mobile/src/presentation/home-assistant/home-assistant-screen.tsx
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { FormCard } from '../shared/form-card.js'
import { AuthField } from '../identity/auth-field.js'
import { Chip } from '../shared/chip.js'
import { PillButton } from '../shared/pill-button.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { HomeIcon, LogOutIcon } from '../dashboard/dashboard-icons.js'
import { TodoEntityPicker } from './todo-entity-picker.js'
import { useHaLinkQuery } from '../../application/home-assistant/ha-link.query.js'
import { useSaveHaConnectionMutation } from '../../application/home-assistant/save-ha-connection.mutation.js'
import { useDiscoverHaTodoEntitiesMutation } from '../../application/home-assistant/discover-ha-todo-entities.mutation.js'
import { useBindHaListMutation } from '../../application/home-assistant/bind-ha-list.mutation.js'
import { useUnlinkHaMutation } from '../../application/home-assistant/unlink-ha.mutation.js'
import type { HaSyncDirection, HaTodoEntity } from '../../domain/home-assistant/ha-link.js'

const DIRECTION_LABELS: Record<HaSyncDirection, string> = {
  two_way: 'Deux sens',
  push: 'Vers Home Assistant',
  pull: 'Depuis Home Assistant',
}

const DIRECTION_HINTS: Record<HaSyncDirection, string> = {
  two_way: 'Les ajouts faits ici et dans Home Assistant se retrouvent des deux côtés.',
  push: 'Home Assistant reflète cette liste. Un article supprimé là-bas revient.',
  pull: 'Cette liste suit Home Assistant. Tes modifications ici seront écrasées.',
}

/** French phrasing for the five distinct connection failures — never a
 * single generic message (design §8). */
const CONNECTION_ERROR_MESSAGES: Record<string, string> = {
  unreachable: 'Impossible de joindre cette adresse depuis le serveur.',
  unauthorized: 'Home Assistant a refusé ce jeton.',
  host_not_allowed: "Cet hôte n'est pas autorisé sur ce serveur.",
  invalid_url: "Cette adresse n'est pas valide.",
  token_required: 'Un jeton est requis pour la première connexion.',
}

function lastSyncLabel(lastSyncAt: string | null, lastError: string | null): string {
  if (lastError) return lastError
  if (!lastSyncAt) return 'Jamais synchronisé.'
  const minutes = Math.max(0, Math.round((Date.now() - new Date(lastSyncAt).getTime()) / 60000))
  if (minutes < 1) return 'Synchronisé à l’instant.'
  return `Dernière synchro il y a ${minutes} min.`
}

export function HomeAssistantScreen() {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const link = useHaLinkQuery()
  const saveConnection = useSaveHaConnectionMutation()
  const discoverEntities = useDiscoverHaTodoEntitiesMutation()
  const bindList = useBindHaListMutation()
  const unlink = useUnlinkHaMutation()

  const [step, setStep] = useState<'connect' | 'list'>('connect')
  const [instanceUrl, setInstanceUrl] = useState('')
  const [token, setToken] = useState('')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [entities, setEntities] = useState<HaTodoEntity[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null)
  const [direction, setDirection] = useState<HaSyncDirection>('two_way')
  const [enabled, setEnabled] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmingUnlink, setConfirmingUnlink] = useState(false)

  // A foyer that's already configured lands straight on the list step.
  useEffect(() => {
    if (link.data?.configured) {
      setStep('list')
      setInstanceUrl(link.data.instanceUrl ?? '')
      setSelectedEntityId(link.data.todoEntityId)
      setSelectedEntityName(link.data.todoEntityName)
      setDirection(link.data.direction)
      setEnabled(link.data.enabled)
    }
  }, [link.data])

  // A single call proves the token *and* returns the list (design §8) — no
  // separate ping that succeeds followed by a discovery that fails. Nothing
  // is persisted here: `discoverHaTodoEntities` takes the credentials inline
  // and never touches the stored link. Persistence happens once, in
  // `handleSave()`, when the foyer actually commits to a chosen list.
  async function handleTestConnection() {
    setConnectionError(null)
    const result = await discoverEntities.mutateAsync({ instanceUrl, token })
    if (!result.ok) {
      setConnectionError(CONNECTION_ERROR_MESSAGES[result.error.type] ?? result.error.message)
      return
    }
    if (result.value.length === 0) {
      setConnectionError('Aucune liste todo sur cette instance.')
      return
    }
    setEntities(result.value)
    setStep('list')
  }

  async function handleSave() {
    setSaveError(null)
    if (!selectedEntityId) return

    // `token` is '' when this save is only changing the list/direction on an
    // already-configured link (the user never re-typed it) — the backend
    // keeps the stored token in that case (design §6), so passing it through
    // as-is is correct for both the first-time and the edit-in-place path.
    const saved = await saveConnection.mutateAsync({ instanceUrl, token })
    if (!saved.ok) {
      setSaveError(CONNECTION_ERROR_MESSAGES[saved.error.type] ?? saved.error.message)
      return
    }

    const result = await bindList.mutateAsync({
      todoEntityId: selectedEntityId,
      todoEntityName: selectedEntityName ?? selectedEntityId,
      direction,
      enabled,
    })
    if (!result.ok) {
      setSaveError(result.error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['ha-link'] })
    router.back()
  }

  async function handleUnlink() {
    setConfirmingUnlink(false)
    await unlink.mutateAsync(undefined)
    queryClient.invalidateQueries({ queryKey: ['ha-link'] })
    router.back()
  }

  return (
    <AppShell
      nav={{ kind: 'stack' }}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <HomeIcon size={19} color={color} />}
          title="Maison connectée"
          onBack={() => router.back()}
        />
      }
    >
      {step === 'connect' ? (
        <FormCard palette={palette}>
          <AuthField
            testID="ha-instance-url"
            label="Adresse de l'instance"
            placeholder="http://homeassistant.local:8123"
            value={instanceUrl}
            onChangeText={setInstanceUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          <AuthField
            testID="ha-token"
            label="Jeton d'accès longue durée"
            placeholder="Jeton"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            secureTextEntry
          />
          {connectionError ? (
            <Text fontSize={13} color={palette.expiredText} accessibilityLiveRegion="polite">
              {connectionError}
            </Text>
          ) : null}
          <PillButton
            testID="ha-test-connection"
            label="Tester la connexion"
            palette={palette}
            onPress={handleTestConnection}
          />
        </FormCard>
      ) : (
        <YStack gap="$4">
          <TodoEntityPicker
            entities={entities.length > 0 ? entities : link.data?.todoEntityId && link.data.todoEntityName
              ? [{ entityId: link.data.todoEntityId, friendlyName: link.data.todoEntityName }]
              : []}
            selectedEntityId={selectedEntityId}
            onSelect={(entityId, friendlyName) => {
              setSelectedEntityId(entityId)
              setSelectedEntityName(friendlyName)
            }}
          />

          <YStack gap="$2">
            <Text fontSize={13} color={palette.inkSecondary}>
              Sens de synchronisation
            </Text>
            <XStack gap="$3" flexWrap="wrap">
              {(Object.keys(DIRECTION_LABELS) as HaSyncDirection[]).map((value) => (
                <Chip
                  key={value}
                  label={DIRECTION_LABELS[value]}
                  selected={direction === value}
                  onPress={() => setDirection(value)}
                  palette={palette}
                />
              ))}
            </XStack>
            <Text fontSize={12} color={palette.inkSecondary}>
              {DIRECTION_HINTS[direction]}
            </Text>
          </YStack>

          <Text fontSize={12} color={palette.inkSecondary}>
            {lastSyncLabel(link.data?.lastSyncAt ?? null, link.data?.lastError ?? null)}
          </Text>

          {saveError ? (
            <Text fontSize={13} color={palette.expiredText} accessibilityLiveRegion="polite">
              {saveError}
            </Text>
          ) : null}

          <PillButton testID="ha-save" label="Enregistrer" palette={palette} onPress={handleSave} />

          <Text
            fontSize={13}
            fontWeight="600"
            color={palette.inkSecondary}
            onPress={() => setStep('connect')}
          >
            Modifier la connexion
          </Text>

          <PillButton
            testID="ha-unlink"
            label="Délier"
            tone="quiet"
            palette={palette}
            icon={(color) => <LogOutIcon size={16} color={color} />}
            onPress={() => setConfirmingUnlink(true)}
          />
        </YStack>
      )}

      <ActionSheet
        visible={confirmingUnlink}
        title="Délier Home Assistant ?"
        description="La liste de courses ne sera plus synchronisée avec cette instance."
        options={[
          {
            testID: 'ha-unlink-confirm',
            label: 'Délier',
            icon: (color) => <LogOutIcon size={18} color={color} />,
            tint: palette.expiredBg,
            destructive: true,
            onPress: handleUnlink,
          },
        ]}
        onClose={() => setConfirmingUnlink(false)}
      />
    </AppShell>
  )
}
```

Before finalizing, verify every imported symbol actually exists with that exact name and signature — re-read `mobile/src/presentation/shared/app-shell.tsx`, `screen-header.tsx`, `pill-button.tsx`, `action-sheet.tsx`, and `mobile/src/presentation/identity/auth-field.tsx` in full (this plan only saw excerpts of some of them earlier) and correct any prop name that doesn't match — in particular `AuthField`'s exact prop list, `ActionSheet`'s exact prop list, and whether `PillButton` accepts an `icon` render-prop the way assumed above.

- [ ] **Step 4: Run to verify it passes**

Run: `cd mobile && pnpm run test -- home-assistant-screen`
Expected: PASS, 4 tests.

- [ ] **Step 5: Typecheck**

Run: `cd mobile && pnpm run typecheck`
Expected: no errors.

- [ ] **Step 6: Boundary-lint**

Run: `cd mobile && pnpm run boundaries`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/presentation/home-assistant/home-assistant-screen.tsx mobile/src/presentation/home-assistant/home-assistant-screen.test.tsx
git commit -m "feat(mobile): add the Home Assistant connection screen"
```

---

## Task 23: Settings-screen entry point

**Files:**
- Modify: `mobile/src/presentation/settings/settings-screen.tsx`
- Modify: `mobile/src/presentation/settings/settings-screen.test.tsx`

**Interfaces:**
- Consumes: `useHaLinkQuery` (Task 19), `useHouseholdQuery` (existing, already imported in this file).
- Produces: a "Maison connectée" section between the AI block and sign-out, visible only when `household.data?.role === 'owner'` — same gating pattern as `household-screen.tsx:55`'s `isOwner = data?.role === 'owner'`.

- [ ] **Step 1: Read the current file in full**

Run: `cat mobile/src/presentation/settings/settings-screen.tsx`

- [ ] **Step 2: Write the failing test first**

Append to `mobile/src/presentation/settings/settings-screen.test.tsx` (read the whole file first to match its `renderAuthenticated()` helper and fixture conventions):

```tsx
test('shows the Home Assistant section for a foyer owner', async () => {
  await renderAuthenticated()
  await waitFor(() => expect(screen.getByText('Maison connectée')).toBeTruthy())
})

test('hides the Home Assistant section for a foyer member', async () => {
  const connector = new FakeFridgeConnector()
  // Read fixtures/household.fixture.ts — `fakeHousehold.role` is 'owner' by
  // default (Demo User, fake-user-1). This test needs a *member* session:
  // check how `household.repository`/`household-screen.test.tsx` simulate
  // the second fixture user (`fake-user-2`, role 'member') signing in, and
  // reuse that same mechanism rather than inventing a new one.
  await connector.signInSocial()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <SettingsScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  await waitFor(() => expect(screen.getByText('Maison Bellevue')).toBeTruthy())
  expect(screen.queryByText('Maison connectée')).toBeNull()
})
```

(If the fake connector has no ready mechanism to sign in as the *member* fixture user rather than the owner, that's a real gap this test needs closed first — check `fake-fridge-connector.ts`'s `signInSocial()`/`getHousehold()` for whether the household's `role` field is derived from which user id is "signed in" or is simply hardcoded to `'owner'` in the fixture regardless of who's asking. If it's hardcoded, add a minimal way to override it for this one test — e.g. a second export `fakeHouseholdAsMember` in `household.fixture.ts` with `role: 'member'`, and a fake-connector constructor option or setter to use it — rather than skip the test.)

- [ ] **Step 3: Run to verify both fail**

Run: `cd mobile && pnpm run test -- settings-screen`
Expected: FAIL — "Maison connectée" doesn't exist yet, and/or the member-fixture mechanism doesn't exist yet (resolve that gap as part of this step, per the note above, before moving on).

- [ ] **Step 4: Add the section**

In `settings-screen.tsx`, add the query hook near the other query hooks at the top of `SettingsScreen()`:

```tsx
  const haLink = useHaLinkQuery()
```

and the import:

```tsx
import { useHaLinkQuery } from '../../application/home-assistant/ha-link.query.js'
import { HomeIcon as HaHomeIcon } from '../dashboard/dashboard-icons.js' // reuse, or pick whichever icon already reads as "home" in dashboard-icons.js — HomeIcon is already imported once for the "Foyer" card above, so alias it rather than import it twice
```

(if `HomeIcon` is already imported once in this file for the household card, don't re-import it under an alias — just reuse the existing `HomeIcon` import for this section's icon too, and drop the alias above; check the file's current imports before adding this line.)

Then, between the AI section (`</YStack>` that closes the "Intelligence artificielle" block) and the sign-out `<YStack marginTop="$8" ...>`, add:

```tsx
      {household.data?.role === 'owner' ? (
        <YStack marginTop="$6" gap="$2">
          <SectionLabel palette={palette} icon={<HomeIcon size={15} color={palette.inkSecondary} />}>
            Maison connectée
          </SectionLabel>
          <Text fontSize={13} color={palette.inkSecondary}>
            Garde ta liste de courses en phase avec Home Assistant.
          </Text>
          <Text
            testID="ha-settings-row"
            fontSize={14}
            fontWeight="700"
            color={palette.ink}
            marginTop="$1"
            onPress={() => router.push('/home-assistant')}
          >
            {haLink.data?.configured && haLink.data.todoEntityName ? haLink.data.todoEntityName : 'Non configuré'}
          </Text>
        </YStack>
      ) : null}
```

- [ ] **Step 5: Run to verify both pass**

Run: `cd mobile && pnpm run test -- settings-screen`
Expected: PASS.

- [ ] **Step 6: Run the full mobile suite, typecheck, boundaries**

Run: `cd mobile && pnpm run test && pnpm run typecheck && pnpm run boundaries`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/presentation/settings/settings-screen.tsx mobile/src/presentation/settings/settings-screen.test.tsx mobile/src/infrastructure/fake/fixtures/household.fixture.ts
git commit -m "feat(mobile): surface Home Assistant configuration from Réglages, owners only"
```

---

## Task 24: Wire the reconcile into the shopping list's pull-to-refresh

**Files:**
- Modify: `mobile/src/presentation/shopping-list/shopping-list-screen.tsx`
- Modify: `mobile/src/presentation/shopping-list/shopping-list-screen.test.tsx`

**Interfaces:**
- Consumes: `useSyncShoppingListWithHaMutation` (Task 19), the existing `usePullToRefresh` (`../shared/pull-to-refresh.js`).

A sync failure must not swallow the refresh — items still reload from local, and the failure surfaces as a quiet line, never a blocking error (design §8).

- [ ] **Step 1: Read the current file in full**

Run: `cat mobile/src/presentation/shopping-list/shopping-list-screen.tsx`

- [ ] **Step 2: Write the failing test**

Append to `mobile/src/presentation/shopping-list/shopping-list-screen.test.tsx` (match its existing render/fixture helpers):

```tsx
test('pull-to-refresh syncs with Home Assistant before reloading the list', async () => {
  const connector = new FakeFridgeConnector()
  const syncSpy = jest.spyOn(connector, 'syncShoppingListWithHa')
  // ...render however this file's existing tests render the screen, then:
  await act(async () => {
    /* trigger the same refresh path the file's existing pull-to-refresh
       test already exercises — reuse it, don't invent a new one */
  })
  expect(syncSpy).toHaveBeenCalled()
})

test('a sync failure does not block the list from reloading', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'syncShoppingListWithHa').mockResolvedValue({
    ok: false,
    error: { type: 'unreachable', message: 'Impossible de joindre cette adresse depuis le serveur.' },
  })
  // ...render and trigger refresh the same way as above, then assert the
  // existing item list still renders (whatever assertion the file's other
  // refresh test already makes for "the list is still there").
})
```

(Write these against whatever this file's *actual* existing render/refresh-trigger helpers are — read the whole file before appending, this plan does not have it in front of it verbatim.)

- [ ] **Step 3: Run to verify it fails**

Run: `cd mobile && pnpm run test -- shopping-list-screen`
Expected: FAIL — `syncShoppingListWithHa` isn't called yet.

- [ ] **Step 4: Wire the sync**

Find the file's `usePullToRefresh(...)` call and add a sync step ahead of the existing refetches:

```tsx
  const syncWithHa = useSyncShoppingListWithHaMutation()
  const refresh = usePullToRefresh(
    async () => {
      await syncWithHa.mutateAsync(undefined).catch(() => undefined) // best-effort — a failed sync must not block the reload
    },
    () => items.refetch(),
    // ...any other existing refetch() calls in the current usePullToRefresh(...) list, unchanged
  )
```

and the import:

```tsx
import { useSyncShoppingListWithHaMutation } from '../../application/home-assistant/sync-shopping-list-with-ha.mutation.js'
```

(Match this exactly to the file's actual current `usePullToRefresh(...)` call — read it first; the snippet above shows the shape of the change, not a guess at the surrounding code, which Step 1 already read.)

- [ ] **Step 5: Run to verify it passes**

Run: `cd mobile && pnpm run test -- shopping-list-screen`
Expected: PASS.

- [ ] **Step 6: Run the full mobile suite, typecheck, boundaries**

Run: `cd mobile && pnpm run test && pnpm run typecheck && pnpm run boundaries`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/presentation/shopping-list/shopping-list-screen.tsx mobile/src/presentation/shopping-list/shopping-list-screen.test.tsx
git commit -m "feat(mobile): sync with Home Assistant on shopping-list pull-to-refresh"
```

---

## Task 25: Full-stack verification

**Files:** none — this task runs the complete check, no code changes expected.

- [ ] **Step 1: Run the backend's full CI-equivalent check**

Run: `cd backend && pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run boundaries`
Expected: all pass.

- [ ] **Step 2: Run the mobile's full CI-equivalent check**

Run: `cd mobile && pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run boundaries`
Expected: all pass.

- [ ] **Step 3: Run the whole project's `task check`**

Run: `cd .. && task check`
Expected: all eight steps (lint, typecheck, test, boundaries × 2 packages) pass — this is exactly what CI runs.

- [ ] **Step 4: Manual smoke test against a real (or a throwaway local) Home Assistant instance**

This is the one thing no automated test in this plan exercises end-to-end: a real `PUT` that pings a real Home Assistant, a real `discover` that lists its real `todo.*` entities, and a real reconcile pass. Run `task dev` (backend) and `task dev:mobile`, sign in, open Réglages → Maison connectée as a foyer owner, and connect against a real or throwaway Home Assistant instance with a `todo` helper configured (Settings → Automations & Scenes → Helpers → To-do List, in Home Assistant) and a long-lived access token (profile → Security → Long-Lived Access Tokens). Add an item on the phone, confirm it appears in Home Assistant; add one in Home Assistant, pull-to-refresh on the phone, confirm it appears there.

- [ ] **Step 5: Update the household ADR references**

The spec names two ADRs to write (`ADR-0012` encryption-at-rest, `ADR-0013` Home Assistant integration) — this plan does not include writing them as a task, since they document a decision already made rather than code to build. Write them now, following the existing ADR format (`docs/adr/0011-observabilite-otel-collector-openobserve.md` as the template), covering exactly what design §10 lists, and commit them separately.

Run: `cd .. && git add docs/adr/0012-*.md docs/adr/0013-*.md && git commit -m "docs: add ADR-0012 (encryption at rest) and ADR-0013 (Home Assistant integration)"`

This closes the plan.
