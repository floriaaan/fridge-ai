# Phase 2 — Fridge, Receipt, Settings (AI provider) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ship the next independently-testable backend slice on top of Phase 1: the
`settings` (AI provider, instance-wide, hot-reloadable), `fridge` (Product), and
`receipt` (scan → import) bounded contexts. Every `fridge`/`receipt` resource is
scoped by `householdId` via `household_required_middleware` — attached to real
routes for the first time in this phase.

**Architecture:** Same layering as Phase 1 (`src/{domain,application,
infrastructure,presentation}`, DDD strict, dependency-cruiser enforced). New
cross-cutting piece: `StorageService` (port + local-filesystem implementation) for
`imageKey`-backed images, served via authenticated nested routes. `settings`'s
`AiProviderRegistry` hot-reloads the active AI provider using the exact
cache-by-signature pattern `arr` uses for its `getAuthInstance` — reused, not
reinvented.

**Tech Stack:** Same as Phase 1, plus `@google/genai` (Gemini vision), `openai`
(GPT-4o-class vision) — added this phase. Ollama uses plain `fetch`, no SDK.

**Spec:** `docs/superpowers/specs/2026-08-26-phase-2-fridge-receipt-settings-design.md`
(this plan implements it — read it first for the *why*; this doc has the *how*).
Also: `docs/phase-0/02-modele-de-domaine.md` (`fridge`/`receipt`/`settings`
sections), `docs/phase-0/03-schema-base-de-donnees.md` (`product`/`receipt`/
`ai_provider_setting` tables), `docs/phase-0/04-endpoints-http.md` (`fridge`/
`receipt` sections), ADR-0006 through ADR-0010.

## Global Constraints

- Clean architecture / DDD strict, dependency-cruiser-enforced — same four rules as
  Phase 1 (`docs/adr/0002`). This phase adds a real test of the
  `application`→`infrastructure` rule: receipt's use-cases must import extraction
  failure types from `#domain/receipt/*`, never from `#infrastructure/settings/*`
  (see Task 8's rationale).
- Every `fridge`/`receipt` table is scoped by `household_id` (`docs/adr/0003`).
  `ai_provider_setting` stays the one exception — instance-wide, no `household_id`
  (`docs/adr/0007`).
- Error envelope: `{ error: { type, message, details? } }`, French user-facing
  messages — same `error-serializer.ts` extended in place, never a parallel
  mechanism.
- `ReceiptExtractionPort.extract()` — one multimodal AI call, no separate OCR step
  (ADR-0006).
- Barcode decoding stays client-side; the backend only ever receives the decoded
  string (ADR-0008).
- No `public/` static folder for user images — every image is served through a
  route nested in its owning resource, same authorization guard as that resource
  (ADR-0009).
- No fridge-scan/statistics/HA integration, no schema pre-wiring for them
  (ADR-0010).
- No test calls a real AI provider or OpenFoodFacts — external calls are faked at
  the seam nearest their port (see Task 6, Task 9, Task 10).

---

## Task 1: Settings domain + persistence + `GET`/`PATCH /api/settings/ai`

**Files:**
- Create: `backend/src/domain/settings/ai-provider.vo.ts`
- Create: `backend/src/domain/settings/effective-ai-settings.ts`
- Create: `backend/src/domain/settings/ai-provider-settings.aggregate.ts`
- Create: `backend/src/domain/settings/interfaces/ai-provider-settings-repository.interface.ts`
- Create: `backend/src/domain/settings/interfaces/ai-settings-provider.interface.ts`
- Create: `backend/src/infrastructure/database/settings/ai-provider-setting.lucid.ts`
- Create: `backend/src/infrastructure/database/settings/ai-provider-setting.mapper.ts`
- Create: `backend/src/infrastructure/database/settings/ai-provider-settings.repository.ts`
- Create: `backend/src/infrastructure/settings/env-ai-settings-provider.ts`
- Create: `backend/src/application/settings/get-effective-ai-settings.use-case.ts`
- Create: `backend/src/application/settings/set-active-ai-provider.use-case.ts`
- Create: `backend/src/presentation/settings/ai-settings.dto.ts`
- Create: `backend/src/presentation/settings/ai-settings.validator.ts`
- Create: `backend/src/presentation/settings/ai-settings.controller.ts`
- Create: `backend/src/presentation/settings/ai-settings.routes.ts`
- Create: `backend/providers/settings_provider.ts`
- Modify: `backend/adonisrc.ts` (register `SettingsProvider`)
- Modify: `backend/start/routes.ts` (import `ai-settings.routes`)
- Modify: `backend/start/env.ts` (add `AI_PROVIDER`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_BASE_URL`)
- Modify: `.env.example`, `backend/.env`
- Modify: `backend/src/presentation/shared/error-serializer.ts`
- Test: `backend/tests/unit/domain/settings/ai-provider-settings.aggregate.spec.ts`
- Test: `backend/tests/functional/settings/ai-settings.spec.ts`

**Interfaces:**
- Consumes: `AggregateRoot`, `Result`, `ValidationError` (Phase 1 Task 4).
  `HouseholdRepository` via the `identity.households` binding (Phase 1 Task 7) —
  reused for the owner check, no new binding.
- Produces: `type AiProvider = 'gemini' | 'openai' | 'ollama'`.
  `AiProviderSettings.seedFromEnv(id, defaultProvider, now): AiProviderSettings`,
  `.reconstruct(id, props)`, `.activeProvider`, `.updatedBy`, `.updatedAt`,
  `.changeProvider(provider, changedBy, now): void`. `EffectiveAiSettings { activeProvider,
  source: 'database' | 'environment', availableProviders: AiProvider[] }`.
  `AiSettingsProvider.resolveEffective(): Promise<EffectiveAiSettings>` — the
  container binding `settings.aiSettingsProvider: AiSettingsProvider` is what Task 9
  wires the AI-provider registry to. `settings.aiProviderSettingsRepository:
  AiProviderSettingsRepository`.

- [ ] **Step 1: Domain — `AiProvider`, `EffectiveAiSettings`, `AiProviderSettings`**

```ts
// backend/src/domain/settings/ai-provider.vo.ts
export type AiProvider = 'gemini' | 'openai' | 'ollama'

export const AI_PROVIDERS: readonly AiProvider[] = ['gemini', 'openai', 'ollama']
```

```ts
// backend/src/domain/settings/effective-ai-settings.ts
import type { AiProvider } from './ai-provider.vo.js'

/** Never persisted — `AiSettingsProvider.resolveEffective()`'s return shape. */
export interface EffectiveAiSettings {
  activeProvider: AiProvider
  source: 'database' | 'environment'
  availableProviders: AiProvider[]
}
```

```ts
// backend/src/domain/settings/ai-provider-settings.aggregate.ts
import { AggregateRoot } from '#domain/shared/aggregate-root'
import type { AiProvider } from './ai-provider.vo.js'

interface AiProviderSettingsProps {
  activeProvider: AiProvider
  updatedBy: string | null
  updatedAt: Date
}

/**
 * Singleton (one row ever, enforced by the repository's upsert, cf.
 * docs/phase-0/03-schema-base-de-donnees.md — same convention as `Household`
 * not enforcing "one household per user" in the aggregate either, cf. ADR-0003).
 * `changeProvider` returns `void`, not `Result<void>` as the domain doc's
 * sketch suggested — every `AiProvider` value is valid at this aggregate's
 * level; whether the caller is an owner (application concern) or the
 * provider has credentials configured (`AiSettingsProvider`'s concern, not
 * this aggregate's) are both checked one layer up, in
 * `SetActiveAiProvider`.
 */
export class AiProviderSettings extends AggregateRoot<string> {
  private props: AiProviderSettingsProps

  private constructor(id: string, props: AiProviderSettingsProps) {
    super(id)
    this.props = props
  }

  static seedFromEnv(id: string, defaultProvider: AiProvider, now: Date): AiProviderSettings {
    return new AiProviderSettings(id, { activeProvider: defaultProvider, updatedBy: null, updatedAt: now })
  }

  static reconstruct(id: string, props: AiProviderSettingsProps): AiProviderSettings {
    return new AiProviderSettings(id, props)
  }

  get activeProvider(): AiProvider {
    return this.props.activeProvider
  }

  get updatedBy(): string | null {
    return this.props.updatedBy
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  changeProvider(provider: AiProvider, changedBy: string, now: Date): void {
    this.props = { activeProvider: provider, updatedBy: changedBy, updatedAt: now }
  }
}
```

```ts
// backend/src/domain/settings/interfaces/ai-provider-settings-repository.interface.ts
import type { AiProviderSettings } from '../ai-provider-settings.aggregate.js'

export interface AiProviderSettingsRepository {
  find(): Promise<AiProviderSettings | null>
  save(settings: AiProviderSettings): Promise<void>
}
```

```ts
// backend/src/domain/settings/interfaces/ai-settings-provider.interface.ts
import type { EffectiveAiSettings } from '../effective-ai-settings.js'

export interface AiSettingsProvider {
  resolveEffective(): Promise<EffectiveAiSettings>
}
```

- [ ] **Step 2: Write the failing unit test**

```ts
// backend/tests/unit/domain/settings/ai-provider-settings.aggregate.spec.ts
import { test } from '@japa/runner'
import { AiProviderSettings } from '#domain/settings/ai-provider-settings.aggregate'

test.group('AiProviderSettings', () => {
  test('seedFromEnv() sets the default provider with no updatedBy', ({ assert }) => {
    const settings = AiProviderSettings.seedFromEnv('s_1', 'gemini', new Date('2026-08-26T10:00:00Z'))
    assert.equal(settings.activeProvider, 'gemini')
    assert.isNull(settings.updatedBy)
  })

  test('changeProvider() updates the active provider and audit fields', ({ assert }) => {
    const settings = AiProviderSettings.seedFromEnv('s_1', 'gemini', new Date('2026-08-26T10:00:00Z'))
    settings.changeProvider('ollama', 'u_owner', new Date('2026-08-26T11:00:00Z'))
    assert.equal(settings.activeProvider, 'ollama')
    assert.equal(settings.updatedBy, 'u_owner')
    assert.equal(settings.updatedAt.toISOString(), '2026-08-26T11:00:00.000Z')
  })
})
```

Run: `cd backend && node ace test unit`. Expected: FAIL — `#domain/settings/ai-provider-settings.aggregate` doesn't exist yet (create it via Step 1 first if running steps out of order; otherwise this passes immediately — that's fine, the file above IS the implementation).

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd backend && node ace test unit`. Expected: PASS (2 new tests).

- [ ] **Step 4: Persistence — Lucid model, mapper, repository**

```ts
// backend/src/infrastructure/database/settings/ai-provider-setting.lucid.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { AiProvider } from '#domain/settings/ai-provider.vo'

export default class AiProviderSettingModel extends BaseModel {
  static table = 'ai_provider_setting'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'active_provider' })
  declare activeProvider: AiProvider

  @column({ columnName: 'updated_by' })
  declare updatedBy: string | null

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

```ts
// backend/src/infrastructure/database/settings/ai-provider-setting.mapper.ts
import { AiProviderSettings } from '#domain/settings/ai-provider-settings.aggregate'
import type AiProviderSettingModel from './ai-provider-setting.lucid.js'

export function toDomain(row: AiProviderSettingModel): AiProviderSettings {
  return AiProviderSettings.reconstruct(row.id, {
    activeProvider: row.activeProvider,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toJSDate(),
  })
}
```

```ts
// backend/src/infrastructure/database/settings/ai-provider-settings.repository.ts
import AiProviderSettingModel from './ai-provider-setting.lucid.js'
import { toDomain } from './ai-provider-setting.mapper.js'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { AiProviderSettings } from '#domain/settings/ai-provider-settings.aggregate'

/**
 * Singleton table — `find()` reads the only row if one exists (upsert on
 * `save()` keyed by the aggregate's own id, cf. docs/phase-0/03-schema-base-de-donnees.md's
 * note: uniqueness is applicative, not a DB constraint).
 */
export class LucidAiProviderSettingsRepository implements AiProviderSettingsRepository {
  async find(): Promise<AiProviderSettings | null> {
    const row = await AiProviderSettingModel.query().first()
    return row ? toDomain(row) : null
  }

  async save(settings: AiProviderSettings): Promise<void> {
    await AiProviderSettingModel.updateOrCreate(
      { id: settings.id },
      { activeProvider: settings.activeProvider, updatedBy: settings.updatedBy },
    )
  }
}
```

- [ ] **Step 5: `EnvAiSettingsProvider`**

```ts
// backend/src/infrastructure/settings/env-ai-settings-provider.ts
import env from '#start/env'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { EffectiveAiSettings } from '#domain/settings/effective-ai-settings'
import type { AiProvider } from '#domain/settings/ai-provider.vo'
import { AI_PROVIDERS } from '#domain/settings/ai-provider.vo'

const DEFAULT_PROVIDER: AiProvider = 'gemini'

/**
 * Merges the DB row (if any) with the env default — identical precedence to
 * `AuthSettingsProvider` in `arr` (DB wins once it exists, env is the
 * first-boot fallback, cf. docs/adr/0007).
 */
export class EnvAiSettingsProvider implements AiSettingsProvider {
  constructor(private readonly repository: AiProviderSettingsRepository) {}

  async resolveEffective(): Promise<EffectiveAiSettings> {
    const stored = await this.repository.find()
    const activeProvider = stored?.activeProvider ?? env.get('AI_PROVIDER', DEFAULT_PROVIDER) as AiProvider
    const availableProviders = AI_PROVIDERS.filter((provider) => this.hasCredentials(provider))

    return {
      activeProvider,
      source: stored ? 'database' : 'environment',
      availableProviders,
    }
  }

  private hasCredentials(provider: AiProvider): boolean {
    switch (provider) {
      case 'gemini':
        return Boolean(env.get('GEMINI_API_KEY', ''))
      case 'openai':
        return Boolean(env.get('OPENAI_API_KEY', ''))
      case 'ollama':
        return Boolean(env.get('OLLAMA_BASE_URL', ''))
    }
  }
}
```

- [ ] **Step 6: Env vars**

```ts
// backend/start/env.ts — add inside Env.schema.create(...):
  // AI provider (settings, cf. docs/adr/0007) — optional, EnvAiSettingsProvider
  // falls back to a hardcoded default if unset.
  AI_PROVIDER: Env.schema.enum.optional(['gemini', 'openai', 'ollama'] as const),
  GEMINI_API_KEY: Env.schema.string.optional(),
  OPENAI_API_KEY: Env.schema.string.optional(),
  OLLAMA_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
```

```bash
# .env.example and backend/.env — add:
#--------------------------------------------------------------------
# AI provider (settings, cf. docs/adr/0007) — receipt scan needs at least
# one of these configured. Leave a provider's key unset to exclude it from
# `availableProviders`.
#--------------------------------------------------------------------
# AI_PROVIDER=gemini
# GEMINI_API_KEY=
# OPENAI_API_KEY=
# OLLAMA_BASE_URL=http://localhost:11434
```

For `backend/.env` specifically (local dev, not `.env.example`), uncomment and set
`GEMINI_API_KEY=test-key-not-real` — this phase's functional tests need at least
one provider to show up in `availableProviders` without a real credential (no test
ever calls the real Gemini API, cf. Task 9/Task 10).

- [ ] **Step 7: Use-cases**

```ts
// backend/src/application/settings/get-effective-ai-settings.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { EffectiveAiSettings } from '#domain/settings/effective-ai-settings'

export class GetEffectiveAiSettings implements UseCase<Record<string, never>, EffectiveAiSettings> {
  constructor(private readonly settings: AiSettingsProvider) {}

  async execute(): Promise<EffectiveAiSettings> {
    return this.settings.resolveEffective()
  }
}
```

```ts
// backend/src/application/settings/set-active-ai-provider.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import type { AiProvider } from '#domain/settings/ai-provider.vo'
import { AiProviderSettings } from '#domain/settings/ai-provider-settings.aggregate'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface SetActiveAiProviderInput {
  userId: string
  provider: AiProvider
}

export type SetActiveAiProviderError = 'not_owner' | 'provider_not_configured'

export class SetActiveAiProvider
  implements UseCase<SetActiveAiProviderInput, ResultType<AiProviderSettings, SetActiveAiProviderError>>
{
  constructor(
    private readonly repository: AiProviderSettingsRepository,
    private readonly settingsProvider: AiSettingsProvider,
    private readonly households: HouseholdRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: SetActiveAiProviderInput,
  ): Promise<ResultType<AiProviderSettings, SetActiveAiProviderError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household || household.ownerId !== input.userId) return Result.err('not_owner')

    const effective = await this.settingsProvider.resolveEffective()
    if (!effective.availableProviders.includes(input.provider)) {
      return Result.err('provider_not_configured')
    }

    const now = this.clock.now()
    const existing = await this.repository.find()
    const settings = existing ?? AiProviderSettings.seedFromEnv(this.idGenerator.next(), input.provider, now)
    settings.changeProvider(input.provider, input.userId, now)

    await this.repository.save(settings)
    return Result.ok(settings)
  }
}
```

- [ ] **Step 8: DTO, validator, controller, routes**

```ts
// backend/src/presentation/settings/ai-settings.dto.ts
import type { EffectiveAiSettings } from '#domain/settings/effective-ai-settings'

export type AiSettingsDto = EffectiveAiSettings

export function toAiSettingsDto(effective: EffectiveAiSettings): AiSettingsDto {
  return effective
}
```

```ts
// backend/src/presentation/settings/ai-settings.validator.ts
import vine from '@vinejs/vine'

export const setActiveAiProviderValidator = vine.compile(
  vine.object({ provider: vine.enum(['gemini', 'openai', 'ollama'] as const) }),
)
```

```ts
// backend/src/presentation/settings/ai-settings.controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { setActiveAiProviderValidator } from './ai-settings.validator.js'
import { toAiSettingsDto } from './ai-settings.dto.js'
import { GetEffectiveAiSettings } from '#application/settings/get-effective-ai-settings.use-case'
import { SetActiveAiProvider } from '#application/settings/set-active-ai-provider.use-case'

export default class AiSettingsController {
  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const settingsProvider = await ctx.containerResolver.make('settings.aiSettingsProvider')
    const effective = await new GetEffectiveAiSettings(settingsProvider).execute()
    return ctx.response.json(toAiSettingsDto(effective))
  }

  async update(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }

    const effective = await settingsProvider.resolveEffective()
    return ctx.response.json(toAiSettingsDto(effective))
  }
}
```

```ts
// backend/src/presentation/settings/ai-settings.routes.ts
import router from '@adonisjs/core/services/router'

const AiSettingsController = () => import('./ai-settings.controller.js')

router.get('/api/settings/ai', [AiSettingsController, 'show'])
router.patch('/api/settings/ai', [AiSettingsController, 'update'])
```

- [ ] **Step 9: Provider, `adonisrc.ts`, `start/routes.ts`, error-serializer**

```ts
// backend/providers/settings_provider.ts
import type { ApplicationService } from '@adonisjs/core/types'
import type { AiProviderSettingsRepository } from '#domain/settings/interfaces/ai-provider-settings-repository.interface'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'

export default class SettingsProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('settings.aiProviderSettingsRepository', async () => {
      const { LucidAiProviderSettingsRepository } = await import(
        '#infrastructure/database/settings/ai-provider-settings.repository'
      )
      return new LucidAiProviderSettingsRepository()
    })

    this.app.container.singleton('settings.aiSettingsProvider', async () => {
      const { EnvAiSettingsProvider } = await import('#infrastructure/settings/env-ai-settings-provider')
      const repository = await this.app.container.make('settings.aiProviderSettingsRepository')
      return new EnvAiSettingsProvider(repository)
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'settings.aiProviderSettingsRepository': AiProviderSettingsRepository
    'settings.aiSettingsProvider': AiSettingsProvider
  }
}
```

```ts
// backend/adonisrc.ts — add to the `providers` array, after '#providers/identity_provider':
    () => import('#providers/settings_provider'),
```

```ts
// backend/start/routes.ts
import '#presentation/health.routes'
import '#presentation/identity/auth.routes'
import '#presentation/identity/household.routes'
import '#presentation/settings/ai-settings.routes'
```

```ts
// backend/src/presentation/shared/error-serializer.ts — add to both maps:
  provider_not_configured: 422,   // in STRING_ERROR_STATUS
  provider_not_configured: 'Ce provider IA ne dispose pas des identifiants nécessaires.', // in STRING_ERROR_MESSAGES
```
(`not_owner` already exists from Phase 1 — reused as-is.)

- [ ] **Step 10: Functional test**

```ts
// backend/tests/functional/settings/ai-settings.spec.ts
import { test } from '@japa/runner'

async function signUp(client: import('@japa/api-client').ApiClient, email: string) {
  const response = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  return response.headers()['set-cookie']
}

test.group('settings: GET/PATCH /api/settings/ai', () => {
  test('GET reflects the env default when no owner has changed it', async ({ client }) => {
    const cookie = await signUp(client, 'settings-read@example.com')
    const response = await client.get('/api/settings/ai').headers({ cookie })
    response.assertStatus(200)
    response.assertBodyContains({ source: 'environment' })
  })

  test('PATCH is rejected for a user with no household', async ({ client }) => {
    const cookie = await signUp(client, 'settings-no-household@example.com')
    const response = await client.patch('/api/settings/ai').headers({ cookie }).json({ provider: 'gemini' })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'not_owner' } })
  })

  test('PATCH succeeds for a household owner switching to a configured provider', async ({
    client,
    assert,
  }) => {
    const cookie = await signUp(client, 'settings-owner@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer settings' })

    const response = await client.patch('/api/settings/ai').headers({ cookie }).json({ provider: 'gemini' })
    response.assertStatus(200)
    response.assertBodyContains({ activeProvider: 'gemini', source: 'database' })

    const read = await client.get('/api/settings/ai').headers({ cookie })
    read.assertBodyContains({ activeProvider: 'gemini' })
  })

  test('PATCH rejects a provider with no credentials configured', async ({ client }) => {
    const cookie = await signUp(client, 'settings-owner2@example.com')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer settings 2' })

    const response = await client.patch('/api/settings/ai').headers({ cookie }).json({ provider: 'openai' })
    response.assertStatus(422)
    response.assertBodyContains({ error: { type: 'provider_not_configured' } })
  })
})
```

Requires `GEMINI_API_KEY` set (even to a fake value) in `backend/.env` per Step 6,
and `OPENAI_API_KEY` left unset, so the last two tests exercise both branches.

Run: `cd backend && node ace test`. Expected: PASS — all Phase 1 tests still green,
plus 2 unit + 4 functional new ones.

- [ ] **Step 11: Commit**

```bash
git add backend/src/domain/settings backend/src/infrastructure/database/settings backend/src/infrastructure/settings backend/src/application/settings backend/src/presentation/settings backend/providers/settings_provider.ts backend/adonisrc.ts backend/start/routes.ts backend/start/env.ts backend/src/presentation/shared/error-serializer.ts backend/tests/unit/domain/settings backend/tests/functional/settings .env.example backend/.env
git commit -m "feat(settings): AI provider domain, persistence, GET/PATCH /api/settings/ai"
```

---

## Task 2: Fridge + receipt migrations

**Files:**
- Create: `backend/database/migrations/1785200000005_create_receipt_table.ts`
- Create: `backend/database/migrations/1785200000006_create_product_table.ts`

**Interfaces:**
- Consumes: nothing (pure schema).
- Produces: `receipt` and `product` tables, matching
  `docs/phase-0/03-schema-base-de-donnees.md` exactly — Task 5 (fridge persistence)
  and Task 10 (receipt persistence) build Lucid models against these.

Migrated together, in this order, in one task — `product.receipt_id` references
`receipt`, so `receipt` must exist first (cf. the schema doc's own note on this
ordering). Domain/application/presentation code for `receipt` isn't built until
Task 8 onward; that's fine, same pattern Phase 1 used for `ai_provider_setting`
(migrated in Task 5 there, unused until this phase).

- [ ] **Step 1: `receipt` table**

```ts
// backend/database/migrations/1785200000005_create_receipt_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('receipt', (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('store_name').notNullable()
      table.timestamp('scanned_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.decimal('total_amount', 10, 2).notNullable()
      table.text('image_key').nullable()
      table.integer('items_count').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable('receipt', (table) => {
      table.index('household_id')
    })
  }

  async down() {
    this.schema.dropTable('receipt')
  }
}
```

- [ ] **Step 2: `product` table**

```ts
// backend/database/migrations/1785200000006_create_product_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('product', (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('receipt_id').nullable().references('id').inTable('receipt').onDelete('SET NULL')
      table.text('name').notNullable()
      table.integer('quantity').notNullable()
      table.text('unit').notNullable()
      table.text('location').notNullable().checkIn(['fridge', 'freezer', 'pantry'])
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.timestamp('opened_at', { useTz: true }).nullable()
      table.text('category').notNullable()
      table.text('openfoodfact_id').nullable()
      table.specificType('categories', 'text[]').nullable()
      table.decimal('price', 10, 2).nullable()
      table.text('image_key').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable('product', (table) => {
      table.index('household_id')
      table.index('expires_at')
      table.index('receipt_id')
    })
  }

  async down() {
    this.schema.dropTable('product')
  }
}
```

- [ ] **Step 3: Run the migrations**

Run: `cd backend && node ace migration:run`
Expected: both tables created, output lists `1785200000005_create_receipt_table`
then `1785200000006_create_product_table` as migrated. Verify with:
`cd backend && node ace db:table receipt && node ace db:table product` — both
should print their column lists matching the schema above.

- [ ] **Step 4: Regenerate `database/schema.ts`**

Run: `cd backend && node ace migration:run` (already run in Step 3 — the
`indexEntities` hook in `adonisrc.ts` regenerates `database/schema.ts`
automatically on every `migration:run`; if it didn't pick up the new tables, run
`node ace app:generate-schema` directly). Verify `ProductSchema` and
`ReceiptSchema` classes now appear in `backend/database/schema.ts`.

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations backend/database/schema.ts
git commit -m "feat(db): product, receipt migrations"
```

---

## Task 3: `StorageService` (port + local filesystem)

**Files:**
- Create: `backend/src/domain/shared/interfaces/storage.interface.ts`
- Create: `backend/src/infrastructure/storage/local-filesystem-storage.ts`
- Modify: `backend/providers/shared_provider.ts`
- Modify: `backend/start/env.ts` (add `STORAGE_ROOT`)
- Modify: `.env.example`, `backend/.env`
- Test: `backend/tests/infrastructure/storage/local-filesystem-storage.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `StorageService { save(key, buffer, contentType): Promise<void>;
  read(key): Promise<{buffer: Buffer; contentType: string} | null>; delete(key):
  Promise<void> }`. Container binding `shared.storage: StorageService` — consumed
  by Task 7 (product image route) and Task 10 (receipt image route, and
  `imageKey` writes on receipt import — though this phase's import flow doesn't
  actually write an image yet, cf. Task 10's note).

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/infrastructure/storage/local-filesystem-storage.spec.ts
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalFilesystemStorage } from '#infrastructure/storage/local-filesystem-storage'

test.group('LocalFilesystemStorage', (group) => {
  const root = join(tmpdir(), `fridge-ai-storage-test-${randomUUID()}`)
  group.teardown(() => rm(root, { recursive: true, force: true }))

  test('save() then read() round-trips the buffer and content type', async ({ assert }) => {
    const storage = new LocalFilesystemStorage(root)
    await storage.save('receipts/a.jpg', Buffer.from('hello'), 'image/jpeg')

    const file = await storage.read('receipts/a.jpg')
    assert.isNotNull(file)
    assert.equal(file?.buffer.toString(), 'hello')
    assert.equal(file?.contentType, 'image/jpeg')
  })

  test('read() returns null for a missing key', async ({ assert }) => {
    const storage = new LocalFilesystemStorage(root)
    const file = await storage.read('receipts/missing.jpg')
    assert.isNull(file)
  })

  test('delete() removes the file — a later read() returns null', async ({ assert }) => {
    const storage = new LocalFilesystemStorage(root)
    await storage.save('receipts/b.jpg', Buffer.from('bye'), 'image/jpeg')
    await storage.delete('receipts/b.jpg')
    const file = await storage.read('receipts/b.jpg')
    assert.isNull(file)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && node ace test unit`
Expected: FAIL with "Cannot find module '#infrastructure/storage/local-filesystem-storage'".

- [ ] **Step 3: Implement**

```ts
// backend/src/domain/shared/interfaces/storage.interface.ts
export interface StoredFile {
  buffer: Buffer
  contentType: string
}

export interface StorageService {
  save(key: string, buffer: Buffer, contentType: string): Promise<void>
  read(key: string): Promise<StoredFile | null>
  delete(key: string): Promise<void>
}
```

```ts
// backend/src/infrastructure/storage/local-filesystem-storage.ts
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { StorageService, StoredFile } from '#domain/shared/interfaces/storage.interface'

/**
 * Content type isn't derivable from `key` alone (callers choose opaque keys,
 * cf. docs/phase-0/02-modele-de-domaine.md's "clé de stockage opaque, jamais
 * une URL publique") — stored in a `<key>.meta.json` sidecar next to the
 * file rather than pulling in a mime-sniffing dependency.
 */
export class LocalFilesystemStorage implements StorageService {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    return join(this.root, key)
  }

  async save(key: string, buffer: Buffer, contentType: string): Promise<void> {
    const filePath = this.resolve(key)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, buffer)
    await writeFile(`${filePath}.meta.json`, JSON.stringify({ contentType }))
  }

  async read(key: string): Promise<StoredFile | null> {
    const filePath = this.resolve(key)
    try {
      const buffer = await readFile(filePath)
      const meta = JSON.parse(await readFile(`${filePath}.meta.json`, 'utf-8')) as { contentType: string }
      return { buffer, contentType: meta.contentType }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolve(key)
    await rm(filePath, { force: true })
    await rm(`${filePath}.meta.json`, { force: true })
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && node ace test unit`
Expected: PASS (3 new tests).

- [ ] **Step 5: Env var, provider binding**

```ts
// backend/start/env.ts — add:
  // Root directory for locally-stored images (receipts, products) — cf. ADR-0009.
  STORAGE_ROOT: Env.schema.string.optional(),
```

```bash
# .env.example and backend/.env — add:
#--------------------------------------------------------------------
# Local image storage (receipts, products) — cf. docs/adr/0009.
#--------------------------------------------------------------------
STORAGE_ROOT=./data/storage
```

```ts
// backend/providers/shared_provider.ts — add the import and binding:
import type { StorageService } from '#domain/shared/interfaces/storage.interface'

// inside register(), alongside the existing singletons:
    this.app.container.singleton('shared.storage', async () => {
      const { LocalFilesystemStorage } = await import('#infrastructure/storage/local-filesystem-storage')
      const env = (await import('#start/env')).default
      return new LocalFilesystemStorage(env.get('STORAGE_ROOT', './data/storage'))
    })

// inside the ContainerBindings interface augmentation:
    'shared.storage': StorageService
```

`data/` is already gitignored (Phase 1) — `data/storage` needs no extra
`.gitignore` entry.

- [ ] **Step 6: Run the full suite, commit**

Run: `cd backend && node ace test`
Expected: PASS — all previous tests still green, plus the 3 new storage tests.

```bash
git add backend/src/domain/shared/interfaces/storage.interface.ts backend/src/infrastructure/storage backend/providers/shared_provider.ts backend/start/env.ts backend/tests/infrastructure/storage .env.example backend/.env
git commit -m "feat(shared): StorageService (local filesystem)"
```

---

## Task 4: Fridge domain (`Product`, `Quantity`, `Location`)

**Files:**
- Create: `backend/src/domain/fridge/quantity.vo.ts`
- Create: `backend/src/domain/fridge/location.vo.ts`
- Create: `backend/src/domain/fridge/product.entity.ts`
- Create: `backend/src/domain/fridge/interfaces/product-repository.interface.ts`
- Create: `backend/src/domain/fridge/interfaces/product-lookup-port.interface.ts`
- Test: `backend/tests/unit/domain/fridge/quantity.vo.spec.ts`
- Test: `backend/tests/unit/domain/fridge/product.entity.spec.ts`

**Interfaces:**
- Consumes: `AggregateRoot`, `ValueObject`, `Result`, `ValidationError` (Phase 1
  Task 4).
- Produces: `Quantity.create(amount, unit): Result<Quantity, ValidationError>`,
  `.amount`, `.unit`. `Location.create(raw): Result<Location, ValidationError>`,
  `.value: 'fridge' | 'freezer' | 'pantry'`. `Product.create(params): Product`,
  `.reconstruct(id, props): Product`, all getters, `.update(patch, updatedAt):
  void`, `.isExpiringSoon(withinDays, now): boolean`, `.isExpired(now): boolean`.
  `ProductRepository`, `ProductLookupPort` interfaces — implemented in Task 5/6.

- [ ] **Step 1: Write the failing tests**

```ts
// backend/tests/unit/domain/fridge/quantity.vo.spec.ts
import { test } from '@japa/runner'
import { Quantity } from '#domain/fridge/quantity.vo'

test.group('Quantity', () => {
  test('accepts a positive integer amount with a unit', ({ assert }) => {
    const result = Quantity.create(2, 'piece')
    assert.isTrue(result.ok)
    if (result.ok) {
      assert.equal(result.value.amount, 2)
      assert.equal(result.value.unit, 'piece')
    }
  })

  test('rejects a non-integer amount', ({ assert }) => {
    // product.quantity is an INTEGER column (docs/phase-0/03-schema-base-de-donnees.md)
    const result = Quantity.create(1.5, 'kg')
    assert.isFalse(result.ok)
  })

  test('rejects a zero or negative amount', ({ assert }) => {
    const result = Quantity.create(0, 'kg')
    assert.isFalse(result.ok)
  })

  test('rejects an empty unit', ({ assert }) => {
    const result = Quantity.create(1, '   ')
    assert.isFalse(result.ok)
  })
})
```

```ts
// backend/tests/unit/domain/fridge/product.entity.spec.ts
import { test } from '@japa/runner'
import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'

function buildProduct(expiresAt: Date | null = null) {
  const quantity = Quantity.create(1, 'L')
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
    createdAt: new Date('2026-08-26T10:00:00Z'),
  })
}

test.group('Product', () => {
  test('create() defaults optional fields to null', ({ assert }) => {
    const product = buildProduct()
    assert.isNull(product.receiptId)
    assert.isNull(product.openedAt)
    assert.isNull(product.price)
    assert.isNull(product.imageKey)
    assert.equal(product.updatedAt.toISOString(), product.createdAt.toISOString())
  })

  test('update() merges the patch and stamps updatedAt', ({ assert }) => {
    const product = buildProduct()
    product.update({ name: 'Lait entier' }, new Date('2026-08-26T11:00:00Z'))
    assert.equal(product.name, 'Lait entier')
    assert.equal(product.updatedAt.toISOString(), '2026-08-26T11:00:00.000Z')
  })

  test('isExpiringSoon() is true within the window, false outside it', ({ assert }) => {
    const now = new Date('2026-08-26T00:00:00Z')
    const soon = buildProduct(new Date('2026-08-28T00:00:00Z'))
    const far = buildProduct(new Date('2026-09-26T00:00:00Z'))
    assert.isTrue(soon.isExpiringSoon(3, now))
    assert.isFalse(far.isExpiringSoon(3, now))
  })

  test('isExpiringSoon() is false once already expired', ({ assert }) => {
    const now = new Date('2026-08-26T00:00:00Z')
    const expired = buildProduct(new Date('2026-08-20T00:00:00Z'))
    assert.isFalse(expired.isExpiringSoon(3, now))
  })

  test('isExpiringSoon() is false with no expiry date', ({ assert }) => {
    const now = new Date('2026-08-26T00:00:00Z')
    assert.isFalse(buildProduct(null).isExpiringSoon(3, now))
  })

  test('isExpired() is true only once past expiresAt', ({ assert }) => {
    const now = new Date('2026-08-26T00:00:00Z')
    assert.isTrue(buildProduct(new Date('2026-08-20T00:00:00Z')).isExpired(now))
    assert.isFalse(buildProduct(new Date('2026-09-01T00:00:00Z')).isExpired(now))
    assert.isFalse(buildProduct(null).isExpired(now))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && node ace test unit`
Expected: FAIL with "Cannot find module '#domain/fridge/quantity.vo'" (and
`location.vo`, `product.entity`).

- [ ] **Step 3: Implement**

```ts
// backend/src/domain/fridge/quantity.vo.ts
import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

interface QuantityProps {
  amount: number
  unit: string
}

/**
 * `amount` must be a positive integer, not just positive — the `product`
 * table's `quantity` column is INTEGER (docs/phase-0/03-schema-base-de-donnees.md),
 * so a fractional amount would fail at the DB layer with a far less useful
 * error than this validation gives up front.
 */
export class Quantity extends ValueObject<QuantityProps> {
  private constructor(props: QuantityProps) {
    super(props)
  }

  static create(amount: number, unit: string): Result<Quantity, ValidationError> {
    if (!Number.isInteger(amount) || amount <= 0) {
      return Result.err({ field: 'quantity', message: 'La quantité doit être un entier supérieur à 0.' })
    }
    const trimmedUnit = unit.trim()
    if (trimmedUnit.length === 0) {
      return Result.err({ field: 'quantity', message: "L'unité est requise." })
    }
    return Result.ok(new Quantity({ amount, unit: trimmedUnit }))
  }

  get amount(): number {
    return this.props.amount
  }

  get unit(): string {
    return this.props.unit
  }
}
```

```ts
// backend/src/domain/fridge/location.vo.ts
import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export type LocationValue = 'fridge' | 'freezer' | 'pantry'

const VALID_LOCATIONS: readonly LocationValue[] = ['fridge', 'freezer', 'pantry']

interface LocationProps {
  value: LocationValue
}

export class Location extends ValueObject<LocationProps> {
  private constructor(props: LocationProps) {
    super(props)
  }

  static create(raw: string): Result<Location, ValidationError> {
    if (!VALID_LOCATIONS.includes(raw as LocationValue)) {
      return Result.err({ field: 'location', message: `"${raw}" n'est pas un emplacement valide.` })
    }
    return Result.ok(new Location({ value: raw as LocationValue }))
  }

  get value(): LocationValue {
    return this.props.value
  }
}
```

```ts
// backend/src/domain/fridge/product.entity.ts
import { AggregateRoot } from '#domain/shared/aggregate-root'
import type { Quantity } from './quantity.vo.js'
import type { Location } from './location.vo.js'

interface ProductProps {
  householdId: string
  receiptId: string | null
  name: string
  quantity: Quantity
  location: Location
  expiresAt: Date | null
  openedAt: Date | null
  category: string
  openfoodfactId: string | null
  categories: string[] | null
  price: number | null
  imageKey: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateProductProps {
  id: string
  householdId: string
  name: string
  quantity: Quantity
  location: Location
  category: string
  expiresAt?: Date | null
  openedAt?: Date | null
  openfoodfactId?: string | null
  categories?: string[] | null
  receiptId?: string | null
  price?: number | null
  imageKey?: string | null
  createdAt: Date
}

export interface UpdateProductProps {
  name?: string
  quantity?: Quantity
  location?: Location
  category?: string
  expiresAt?: Date | null
  openedAt?: Date | null
  openfoodfactId?: string | null
  categories?: string[] | null
  price?: number | null
  imageKey?: string | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * `updatedAt` is carried for DTO purposes only — `update()` stamps it from a
 * caller-supplied `Date` (the use-case passes `Clock.now()`) so the response
 * of the same request that triggered the update reflects it immediately;
 * the DB row's real value (Lucid's `autoUpdate`, cf. product.lucid.ts,
 * Task 5) is the source of truth on every subsequent read.
 */
export class Product extends AggregateRoot<string> {
  private props: ProductProps

  private constructor(id: string, props: ProductProps) {
    super(id)
    this.props = props
  }

  static create(params: CreateProductProps): Product {
    return new Product(params.id, {
      householdId: params.householdId,
      receiptId: params.receiptId ?? null,
      name: params.name,
      quantity: params.quantity,
      location: params.location,
      expiresAt: params.expiresAt ?? null,
      openedAt: params.openedAt ?? null,
      category: params.category,
      openfoodfactId: params.openfoodfactId ?? null,
      categories: params.categories ?? null,
      price: params.price ?? null,
      imageKey: params.imageKey ?? null,
      createdAt: params.createdAt,
      updatedAt: params.createdAt,
    })
  }

  static reconstruct(id: string, props: ProductProps): Product {
    return new Product(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }

  get receiptId(): string | null {
    return this.props.receiptId
  }

  get name(): string {
    return this.props.name
  }

  get quantity(): Quantity {
    return this.props.quantity
  }

  get location(): Location {
    return this.props.location
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt
  }

  get openedAt(): Date | null {
    return this.props.openedAt
  }

  get category(): string {
    return this.props.category
  }

  get openfoodfactId(): string | null {
    return this.props.openfoodfactId
  }

  get categories(): string[] | null {
    return this.props.categories
  }

  get price(): number | null {
    return this.props.price
  }

  get imageKey(): string | null {
    return this.props.imageKey
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  /**
   * `patch` must only include keys the caller actually wants to change —
   * never pass `undefined` for "leave as is", omit the key instead (object
   * spread does not treat an explicit `undefined` as "absent").
   */
  update(patch: UpdateProductProps, updatedAt: Date): void {
    this.props = { ...this.props, ...patch, updatedAt }
  }

  isExpiringSoon(withinDays: number, now: Date): boolean {
    if (!this.props.expiresAt) return false
    const threshold = new Date(now.getTime() + withinDays * MS_PER_DAY)
    return this.props.expiresAt >= now && this.props.expiresAt <= threshold
  }

  isExpired(now: Date): boolean {
    return this.props.expiresAt !== null && this.props.expiresAt < now
  }
}
```

```ts
// backend/src/domain/fridge/interfaces/product-repository.interface.ts
import type { Product } from '../product.entity.js'
import type { LocationValue } from '../location.vo.js'

export interface ProductFilters {
  location?: LocationValue
  expiringWithinDays?: number
}

export interface ProductRepository {
  findById(id: string): Promise<Product | null>
  findByHousehold(householdId: string, filters?: ProductFilters): Promise<Product[]>
  findExpiringSoon(householdId: string, withinDays: number): Promise<Product[]>
  save(product: Product): Promise<void>
  delete(id: string): Promise<void>
}
```

```ts
// backend/src/domain/fridge/interfaces/product-lookup-port.interface.ts
export interface ProductLookupResult {
  name: string
  category: string | null
  categories: string[] | null
  imageUrl: string | null
  openfoodfactId: string
}

export interface ProductLookupPort {
  lookupByBarcode(barcode: string): Promise<ProductLookupResult | null>
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && node ace test unit`
Expected: PASS (10 new tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/fridge backend/tests/unit/domain/fridge
git commit -m "feat(fridge): domain (Product, Quantity, Location)"
```

---

## Task 5: Fridge persistence

**Files:**
- Create: `backend/src/infrastructure/database/fridge/product.lucid.ts`
- Create: `backend/src/infrastructure/database/fridge/product.mapper.ts`
- Create: `backend/src/infrastructure/database/fridge/product.repository.ts`
- Create: `backend/providers/fridge_provider.ts`
- Modify: `backend/adonisrc.ts` (register `FridgeProvider`)
- Test: `backend/tests/infrastructure/fridge/product.repository.spec.ts`

**Interfaces:**
- Consumes: `Product`, `Quantity`, `Location`, `ProductRepository`,
  `ProductFilters` (Task 4).
- Produces: `LucidProductRepository implements ProductRepository`. Container
  binding `fridge.products: ProductRepository` — consumed by Task 7's
  use-cases/controller and Task 10's `ImportReceipt`/`GetReceipt`.

- [ ] **Step 1: Lucid model**

```ts
// backend/src/infrastructure/database/fridge/product.lucid.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { LocationValue } from '#domain/fridge/location.vo'

export default class ProductModel extends BaseModel {
  static table = 'product'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'receipt_id' })
  declare receiptId: string | null

  @column()
  declare name: string

  @column()
  declare quantity: number

  @column()
  declare unit: string

  @column()
  declare location: LocationValue

  @column.dateTime({ columnName: 'expires_at' })
  declare expiresAt: DateTime | null

  @column.dateTime({ columnName: 'opened_at' })
  declare openedAt: DateTime | null

  @column()
  declare category: string

  @column({ columnName: 'openfoodfact_id' })
  declare openfoodfactId: string | null

  @column()
  declare categories: string[] | null

  @column()
  declare price: number | null

  @column({ columnName: 'image_key' })
  declare imageKey: string | null

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

- [ ] **Step 2: Mapper**

```ts
// backend/src/infrastructure/database/fridge/product.mapper.ts
import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'
import type ProductModel from './product.lucid.js'

export function toDomain(row: ProductModel): Product {
  const quantity = Quantity.create(row.quantity, row.unit)
  if (!quantity.ok) throw new Error(`Corrupted product row ${row.id}: ${quantity.error.message}`)

  const location = Location.create(row.location)
  if (!location.ok) throw new Error(`Corrupted product row ${row.id}: ${location.error.message}`)

  return Product.reconstruct(row.id, {
    householdId: row.householdId,
    receiptId: row.receiptId,
    name: row.name,
    quantity: quantity.value,
    location: location.value,
    expiresAt: row.expiresAt?.toJSDate() ?? null,
    openedAt: row.openedAt?.toJSDate() ?? null,
    category: row.category,
    openfoodfactId: row.openfoodfactId,
    categories: row.categories,
    price: row.price,
    imageKey: row.imageKey,
    createdAt: row.createdAt.toJSDate(),
    updatedAt: row.updatedAt.toJSDate(),
  })
}
```

- [ ] **Step 3: Repository**

```ts
// backend/src/infrastructure/database/fridge/product.repository.ts
import { DateTime } from 'luxon'
import ProductModel from './product.lucid.js'
import { toDomain } from './product.mapper.js'
import type { ProductRepository, ProductFilters } from '#domain/fridge/interfaces/product-repository.interface'
import type { Product } from '#domain/fridge/product.entity'

export class LucidProductRepository implements ProductRepository {
  async findById(id: string): Promise<Product | null> {
    const row = await ProductModel.find(id)
    return row ? toDomain(row) : null
  }

  async findByHousehold(householdId: string, filters: ProductFilters = {}): Promise<Product[]> {
    const query = ProductModel.query().where('household_id', householdId)
    if (filters.location) query.where('location', filters.location)
    if (filters.expiringWithinDays !== undefined) {
      const threshold = new Date(Date.now() + filters.expiringWithinDays * 24 * 60 * 60 * 1000)
      query.whereNotNull('expires_at').where('expires_at', '<=', threshold.toISOString())
    }
    const rows = await query.orderBy('expires_at', 'asc')
    return rows.map(toDomain)
  }

  async findExpiringSoon(householdId: string, withinDays: number): Promise<Product[]> {
    return this.findByHousehold(householdId, { expiringWithinDays: withinDays })
  }

  async save(product: Product): Promise<void> {
    await ProductModel.updateOrCreate(
      { id: product.id },
      {
        householdId: product.householdId,
        receiptId: product.receiptId,
        name: product.name,
        quantity: product.quantity.amount,
        unit: product.quantity.unit,
        location: product.location.value,
        expiresAt: product.expiresAt ? DateTime.fromJSDate(product.expiresAt) : null,
        openedAt: product.openedAt ? DateTime.fromJSDate(product.openedAt) : null,
        category: product.category,
        openfoodfactId: product.openfoodfactId,
        categories: product.categories,
        price: product.price,
        imageKey: product.imageKey,
      },
    )
  }

  async delete(id: string): Promise<void> {
    await ProductModel.query().where('id', id).delete()
  }
}
```

- [ ] **Step 4: Provider, `adonisrc.ts`**

```ts
// backend/providers/fridge_provider.ts
import type { ApplicationService } from '@adonisjs/core/types'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'

export default class FridgeProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('fridge.products', async () => {
      const { LucidProductRepository } = await import('#infrastructure/database/fridge/product.repository')
      return new LucidProductRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'fridge.products': ProductRepository
  }
}
```

```ts
// backend/adonisrc.ts — add to the `providers` array, after '#providers/settings_provider':
    () => import('#providers/fridge_provider'),
```

- [ ] **Step 5: Infrastructure test**

```ts
// backend/tests/infrastructure/fridge/product.repository.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidProductRepository } from '#infrastructure/database/fridge/product.repository'
import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'

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

function buildProduct(id: string, householdId: string, overrides: Partial<{ location: string; expiresAt: Date | null }> = {}) {
  const quantity = Quantity.create(1, 'L')
  const location = Location.create(overrides.location ?? 'fridge')
  if (!quantity.ok || !location.ok) throw new Error('unreachable')

  return Product.create({
    id,
    householdId,
    name: 'Lait',
    quantity: quantity.value,
    location: location.value,
    category: 'Produits laitiers',
    expiresAt: overrides.expiresAt ?? null,
    createdAt: new Date(),
  })
}

test.group('LucidProductRepository', (group) => {
  group.each.setup(() => db.beginGlobalTransaction())
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('save() then findById() round-trips a product', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')

    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_1', 'h_1'))

    const found = await repository.findById('p_1')
    assert.equal(found?.name, 'Lait')
    assert.equal(found?.quantity.amount, 1)
    assert.equal(found?.location.value, 'fridge')
  })

  test('findByHousehold() filters by location', async ({ assert }) => {
    await createUser('u_2', 'owner2@example.com')
    await createHousehold('h_2', 'u_2')

    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_2', 'h_2', { location: 'fridge' }))
    await repository.save(buildProduct('p_3', 'h_2', { location: 'pantry' }))

    const fridgeOnly = await repository.findByHousehold('h_2', { location: 'fridge' })
    assert.lengthOf(fridgeOnly, 1)
    assert.equal(fridgeOnly[0]?.id, 'p_2')
  })

  test('findExpiringSoon() only returns products within the window', async ({ assert }) => {
    await createUser('u_3', 'owner3@example.com')
    await createHousehold('h_3', 'u_3')

    const soon = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_4', 'h_3', { expiresAt: soon }))
    await repository.save(buildProduct('p_5', 'h_3', { expiresAt: far }))

    const expiring = await repository.findExpiringSoon('h_3', 3)
    assert.lengthOf(expiring, 1)
    assert.equal(expiring[0]?.id, 'p_4')
  })

  test('delete() removes the row', async ({ assert }) => {
    await createUser('u_4', 'owner4@example.com')
    await createHousehold('h_4', 'u_4')

    const repository = new LucidProductRepository()
    await repository.save(buildProduct('p_6', 'h_4'))
    await repository.delete('p_6')

    assert.isNull(await repository.findById('p_6'))
  })
})
```

- [ ] **Step 6: Run tests, commit**

Run: `cd backend && node ace test unit`
Expected: PASS (4 new tests).

```bash
git add backend/src/infrastructure/database/fridge backend/providers/fridge_provider.ts backend/adonisrc.ts backend/tests/infrastructure/fridge
git commit -m "feat(fridge): Lucid persistence"
```

---

## Task 6: `ProductLookupPort` + `OpenFoodFactsAdapter`

**Files:**
- Create: `backend/src/infrastructure/fridge/openfoodfacts-adapter.ts`
- Modify: `backend/providers/fridge_provider.ts`
- Test: `backend/tests/infrastructure/fridge/openfoodfacts-adapter.spec.ts`

**Interfaces:**
- Consumes: `ProductLookupPort`, `ProductLookupResult` (Task 4).
- Produces: `OpenFoodFactsAdapter implements ProductLookupPort`. Container binding
  `fridge.productLookup: ProductLookupPort` — consumed by Task 7's `LookupProduct`
  use-case.

- [ ] **Step 1: Implement (no failing-test step — this wraps a real external API;
  the test mocks `fetch`, cf. Step 2)**

```ts
// backend/src/infrastructure/fridge/openfoodfacts-adapter.ts
import type { ProductLookupPort, ProductLookupResult } from '#domain/fridge/interfaces/product-lookup-port.interface'

const OPENFOODFACTS_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product'

interface OpenFoodFactsResponse {
  status: number
  product?: {
    product_name?: string
    categories_tags?: string[]
    image_url?: string
  }
}

/**
 * Server-side lookup only — barcode *decoding* stays on the app (ADR-0008).
 * "Not found" is `null`, never thrown — it's a normal, expected result the
 * app uses to fall back to a blank form.
 */
export class OpenFoodFactsAdapter implements ProductLookupPort {
  async lookupByBarcode(barcode: string): Promise<ProductLookupResult | null> {
    const response = await fetch(`${OPENFOODFACTS_BASE_URL}/${encodeURIComponent(barcode)}.json`)
    if (!response.ok) return null

    const body = (await response.json()) as OpenFoodFactsResponse
    if (body.status !== 1 || !body.product) return null

    const categories = body.product.categories_tags ?? null
    return {
      name: body.product.product_name ?? 'Produit inconnu',
      category: categories?.[0]?.replace(/^[a-z]{2}:/, '') ?? null,
      categories,
      imageUrl: body.product.image_url ?? null,
      openfoodfactId: barcode,
    }
  }
}
```

- [ ] **Step 2: Test (fetch mocked, no real network call)**

```ts
// backend/tests/infrastructure/fridge/openfoodfacts-adapter.spec.ts
import { test } from '@japa/runner'
import { OpenFoodFactsAdapter } from '#infrastructure/fridge/openfoodfacts-adapter'

test.group('OpenFoodFactsAdapter', (group) => {
  const originalFetch = globalThis.fetch

  group.each.teardown(() => {
    globalThis.fetch = originalFetch
  })

  test('lookupByBarcode() maps a found product', async ({ assert }) => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          status: 1,
          product: { product_name: 'Nutella', categories_tags: ['en:spreads'], image_url: 'https://x/img.jpg' },
        }),
      )) as typeof fetch

    const result = await new OpenFoodFactsAdapter().lookupByBarcode('3017620422003')
    assert.equal(result?.name, 'Nutella')
    assert.equal(result?.category, 'spreads')
    assert.equal(result?.openfoodfactId, '3017620422003')
  })

  test('lookupByBarcode() returns null when not found', async ({ assert }) => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ status: 0 }))) as typeof fetch
    const result = await new OpenFoodFactsAdapter().lookupByBarcode('0000000000000')
    assert.isNull(result)
  })
})
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd backend && node ace test unit`
Expected: PASS (2 new tests).

- [ ] **Step 4: Provider binding**

```ts
// backend/providers/fridge_provider.ts — add the import and binding:
import type { ProductLookupPort } from '#domain/fridge/interfaces/product-lookup-port.interface'

// inside register(), alongside 'fridge.products':
    this.app.container.singleton('fridge.productLookup', async () => {
      const { OpenFoodFactsAdapter } = await import('#infrastructure/fridge/openfoodfacts-adapter')
      return new OpenFoodFactsAdapter()
    })

// inside the ContainerBindings interface augmentation, alongside 'fridge.products':
    'fridge.productLookup': ProductLookupPort
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/infrastructure/fridge backend/providers/fridge_provider.ts backend/tests/infrastructure/fridge/openfoodfacts-adapter.spec.ts
git commit -m "feat(fridge): OpenFoodFacts product lookup adapter"
```

---

## Task 7: Fridge use-cases + HTTP

**Files:**
- Create: `backend/src/application/fridge/create-product.use-case.ts`
- Create: `backend/src/application/fridge/update-product.use-case.ts`
- Create: `backend/src/application/fridge/delete-product.use-case.ts`
- Create: `backend/src/application/fridge/get-product.use-case.ts`
- Create: `backend/src/application/fridge/list-products.use-case.ts`
- Create: `backend/src/application/fridge/get-expiring-soon-products.use-case.ts`
- Create: `backend/src/application/fridge/lookup-product.use-case.ts`
- Create: `backend/src/presentation/fridge/product.dto.ts`
- Create: `backend/src/presentation/fridge/product.validator.ts`
- Create: `backend/src/presentation/fridge/product.controller.ts`
- Create: `backend/src/presentation/fridge/product.routes.ts`
- Modify: `backend/src/presentation/shared/error-serializer.ts`
- Modify: `backend/start/routes.ts`
- Test: `backend/tests/functional/fridge/product.spec.ts`

**Interfaces:**
- Consumes: `ProductRepository`, `ProductLookupPort` (Task 5/6), `Clock`,
  `IdGenerator` (Phase 1 Task 4), `household_required_middleware` (Phase 1 Task 9
  — attached to real routes for the first time here).
- Produces: `GET/POST /api/products`, `GET/PATCH/DELETE /api/products/:id`,
  `GET /api/products/expiring-soon`, `GET /api/products/lookup`,
  `GET /api/products/:id/image` — matching `docs/phase-0/04-endpoints-http.md`.

- [ ] **Step 1: Use-cases**

```ts
// backend/src/application/fridge/create-product.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface CreateProductInput {
  householdId: string
  name: string
  quantity: { amount: number; unit: string }
  location: string
  category: string
  expiresAt?: Date | null
  openedAt?: Date | null
  openfoodfactId?: string | null
  categories?: string[] | null
  price?: number | null
}

export class CreateProduct implements UseCase<CreateProductInput, ResultType<Product, ValidationError>> {
  constructor(
    private readonly products: ProductRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateProductInput): Promise<ResultType<Product, ValidationError>> {
    const quantity = Quantity.create(input.quantity.amount, input.quantity.unit)
    if (!quantity.ok) return quantity

    const location = Location.create(input.location)
    if (!location.ok) return location

    const product = Product.create({
      id: this.idGenerator.next(),
      householdId: input.householdId,
      name: input.name,
      quantity: quantity.value,
      location: location.value,
      category: input.category,
      expiresAt: input.expiresAt ?? null,
      openedAt: input.openedAt ?? null,
      openfoodfactId: input.openfoodfactId ?? null,
      categories: input.categories ?? null,
      price: input.price ?? null,
      createdAt: this.clock.now(),
    })

    await this.products.save(product)
    return Result.ok(product)
  }
}
```

```ts
// backend/src/application/fridge/update-product.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Product, type UpdateProductProps } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'
import type { ValidationError } from '#domain/shared/validation-error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface UpdateProductInput {
  householdId: string
  productId: string
  name?: string
  quantity?: { amount: number; unit: string }
  location?: string
  category?: string
  expiresAt?: Date | null
  openedAt?: Date | null
  openfoodfactId?: string | null
  categories?: string[] | null
  price?: number | null
}

export type UpdateProductError = 'product_not_found' | ValidationError

export class UpdateProduct implements UseCase<UpdateProductInput, ResultType<Product, UpdateProductError>> {
  constructor(
    private readonly products: ProductRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateProductInput): Promise<ResultType<Product, UpdateProductError>> {
    const product = await this.products.findById(input.productId)
    if (!product || product.householdId !== input.householdId) return Result.err('product_not_found')

    const patch: UpdateProductProps = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.category !== undefined) patch.category = input.category
    if (input.expiresAt !== undefined) patch.expiresAt = input.expiresAt
    if (input.openedAt !== undefined) patch.openedAt = input.openedAt
    if (input.openfoodfactId !== undefined) patch.openfoodfactId = input.openfoodfactId
    if (input.categories !== undefined) patch.categories = input.categories
    if (input.price !== undefined) patch.price = input.price

    if (input.quantity !== undefined) {
      const quantity = Quantity.create(input.quantity.amount, input.quantity.unit)
      if (!quantity.ok) return quantity
      patch.quantity = quantity.value
    }

    if (input.location !== undefined) {
      const location = Location.create(input.location)
      if (!location.ok) return location
      patch.location = location.value
    }

    product.update(patch, this.clock.now())
    await this.products.save(product)
    return Result.ok(product)
  }
}
```

```ts
// backend/src/application/fridge/delete-product.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface DeleteProductInput {
  householdId: string
  productId: string
}

export type DeleteProductError = 'product_not_found'

export class DeleteProduct implements UseCase<DeleteProductInput, ResultType<void, DeleteProductError>> {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: DeleteProductInput): Promise<ResultType<void, DeleteProductError>> {
    const product = await this.products.findById(input.productId)
    if (!product || product.householdId !== input.householdId) return Result.err('product_not_found')
    await this.products.delete(product.id)
    return Result.ok(undefined)
  }
}
```

```ts
// backend/src/application/fridge/get-product.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { Product } from '#domain/fridge/product.entity'

export interface GetProductInput {
  householdId: string
  productId: string
}

export class GetProduct implements UseCase<GetProductInput, Product | null> {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: GetProductInput): Promise<Product | null> {
    const product = await this.products.findById(input.productId)
    if (!product || product.householdId !== input.householdId) return null
    return product
  }
}
```

```ts
// backend/src/application/fridge/list-products.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { Product } from '#domain/fridge/product.entity'
import type { LocationValue } from '#domain/fridge/location.vo'

export interface ListProductsInput {
  householdId: string
  location?: LocationValue
  expiringWithinDays?: number
}

export class ListProducts implements UseCase<ListProductsInput, Product[]> {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: ListProductsInput): Promise<Product[]> {
    return this.products.findByHousehold(input.householdId, {
      location: input.location,
      expiringWithinDays: input.expiringWithinDays,
    })
  }
}
```

```ts
// backend/src/application/fridge/get-expiring-soon-products.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { Product } from '#domain/fridge/product.entity'

export interface GetExpiringSoonProductsInput {
  householdId: string
  days: number
}

export class GetExpiringSoonProducts implements UseCase<GetExpiringSoonProductsInput, Product[]> {
  constructor(private readonly products: ProductRepository) {}

  async execute(input: GetExpiringSoonProductsInput): Promise<Product[]> {
    return this.products.findExpiringSoon(input.householdId, input.days)
  }
}
```

```ts
// backend/src/application/fridge/lookup-product.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { ProductLookupPort, ProductLookupResult } from '#domain/fridge/interfaces/product-lookup-port.interface'

export interface LookupProductInput {
  barcode: string
}

export class LookupProduct implements UseCase<LookupProductInput, ProductLookupResult | null> {
  constructor(private readonly lookup: ProductLookupPort) {}

  async execute(input: LookupProductInput): Promise<ProductLookupResult | null> {
    return this.lookup.lookupByBarcode(input.barcode)
  }
}
```

- [ ] **Step 2: DTO, validators**

```ts
// backend/src/presentation/fridge/product.dto.ts
import type { Product } from '#domain/fridge/product.entity'

export interface ProductDto {
  id: string
  name: string
  quantity: { amount: number; unit: string }
  location: string
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

export function toProductDto(product: Product): ProductDto {
  return {
    id: product.id,
    name: product.name,
    quantity: { amount: product.quantity.amount, unit: product.quantity.unit },
    location: product.location.value,
    expiresAt: product.expiresAt?.toISOString() ?? null,
    openedAt: product.openedAt?.toISOString() ?? null,
    category: product.category,
    categories: product.categories,
    openfoodfactId: product.openfoodfactId,
    receiptId: product.receiptId,
    price: product.price,
    imageKey: product.imageKey,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}
```

```ts
// backend/src/presentation/fridge/product.validator.ts
import vine from '@vinejs/vine'

const quantitySchema = vine.object({ amount: vine.number().positive(), unit: vine.string().trim().minLength(1) })
const locationSchema = vine.enum(['fridge', 'freezer', 'pantry'] as const)

export const createProductValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    quantity: quantitySchema,
    location: locationSchema,
    category: vine.string().trim().minLength(1).maxLength(80),
    expiresAt: vine.date().optional(),
    openedAt: vine.date().optional(),
    openfoodfactId: vine.string().trim().optional(),
    categories: vine.array(vine.string().trim()).optional(),
    price: vine.number().positive().optional(),
  }),
)

export const updateProductValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120).optional(),
    quantity: quantitySchema.optional(),
    location: locationSchema.optional(),
    category: vine.string().trim().minLength(1).maxLength(80).optional(),
    expiresAt: vine.date().optional().nullable(),
    openedAt: vine.date().optional().nullable(),
    openfoodfactId: vine.string().trim().optional().nullable(),
    categories: vine.array(vine.string().trim()).optional().nullable(),
    price: vine.number().positive().optional().nullable(),
  }),
)

export const listProductsValidator = vine.compile(
  vine.object({
    location: locationSchema.optional(),
    expiringWithinDays: vine.number().positive().optional(),
  }),
)

export const expiringSoonValidator = vine.compile(vine.object({ days: vine.number().positive().optional() }))

export const lookupProductValidator = vine.compile(vine.object({ barcode: vine.string().trim().minLength(1) }))
```

- [ ] **Step 3: Controller, routes**

```ts
// backend/src/presentation/fridge/product.controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
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
    const { location, expiringWithinDays } = await ctx.request.validateUsing(listProductsValidator)
    const products = await ctx.containerResolver.make('fridge.products')

    const result = await new ListProducts(products).execute({
      householdId: ctx.household.id,
      location,
      expiringWithinDays,
    })
    return ctx.response.json({ products: result.map(toProductDto) })
  }

  async store(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(201).json({ product: toProductDto(result.value) })
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const products = await ctx.containerResolver.make('fridge.products')
    const product = await new GetProduct(products).execute({
      householdId: ctx.household.id,
      productId: ctx.params.id,
    })
    if (!product) {
      const { status, body } = serializeError('product_not_found')
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ product: toProductDto(product) })
  }

  async update(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ product: toProductDto(result.value) })
  }

  async destroy(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const products = await ctx.containerResolver.make('fridge.products')
    const result = await new DeleteProduct(products).execute({
      householdId: ctx.household.id,
      productId: ctx.params.id,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.status(204).send('')
  }

  async expiringSoon(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const { days } = await ctx.request.validateUsing(expiringSoonValidator)
    const products = await ctx.containerResolver.make('fridge.products')
    const result = await new GetExpiringSoonProducts(products).execute({
      householdId: ctx.household.id,
      days: days ?? 3,
    })
    return ctx.response.json({ products: result.map(toProductDto) })
  }

  async lookup(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const { barcode } = await ctx.request.validateUsing(lookupProductValidator)
    const lookupPort = await ctx.containerResolver.make('fridge.productLookup')
    const result = await new LookupProduct(lookupPort).execute({ barcode })
    return ctx.response.json({ result })
  }

  async image(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const products = await ctx.containerResolver.make('fridge.products')
    const product = await new GetProduct(products).execute({
      householdId: ctx.household.id,
      productId: ctx.params.id,
    })
    if (!product || !product.imageKey) {
      const { status, body } = serializeError('image_not_found')
      return ctx.response.status(status).json(body)
    }

    const storage = await ctx.containerResolver.make('shared.storage')
    const file = await storage.read(product.imageKey)
    if (!file) {
      const { status, body } = serializeError('image_not_found')
      return ctx.response.status(status).json(body)
    }

    ctx.response.header('Content-Type', file.contentType)
    return ctx.response.send(file.buffer)
  }
}
```

```ts
// backend/src/presentation/fridge/product.routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ProductController = () => import('./product.controller.js')

/**
 * `expiring-soon` and `lookup` are registered ahead of `:id` — same lesson
 * as Phase 1's `/api/auth/methods` vs `/api/auth/*` ordering fix: Adonis
 * matches routes in registration order, and `:id` would otherwise swallow
 * both literal paths.
 */
router
  .group(() => {
    router.get('/products', [ProductController, 'index'])
    router.post('/products', [ProductController, 'store'])
    router.get('/products/expiring-soon', [ProductController, 'expiringSoon'])
    router.get('/products/lookup', [ProductController, 'lookup'])
    router.get('/products/:id', [ProductController, 'show'])
    router.patch('/products/:id', [ProductController, 'update'])
    router.delete('/products/:id', [ProductController, 'destroy'])
    router.get('/products/:id/image', [ProductController, 'image'])
  })
  .prefix('/api')
  .use([middleware.householdRequired()])
```

```ts
// backend/start/routes.ts
import '#presentation/health.routes'
import '#presentation/identity/auth.routes'
import '#presentation/identity/household.routes'
import '#presentation/settings/ai-settings.routes'
import '#presentation/fridge/product.routes'
```

```ts
// backend/src/presentation/shared/error-serializer.ts — add to both maps:
  product_not_found: 404,
  image_not_found: 404,
  // ...
  product_not_found: 'Produit introuvable.',
  image_not_found: 'Image introuvable.',
```

- [ ] **Step 4: Functional test**

```ts
// backend/tests/functional/fridge/product.spec.ts
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
  test('create → show → update → delete', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'fridge-crud@example.com')

    const create = await client
      .post('/api/products')
      .headers({ cookie })
      .json({ name: 'Lait', quantity: { amount: 1, unit: 'L' }, location: 'fridge', category: 'Produits laitiers' })
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
      .json({ name: 'Farine', quantity: { amount: 0.5, unit: 'kg' }, location: 'pantry', category: 'Épicerie' })
    response.assertStatus(400)
  })

  test('expiring-soon only returns products within the window', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'fridge-expiring@example.com')

    const soon = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
    const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await client
      .post('/api/products')
      .headers({ cookie })
      .json({ name: 'Yaourt', quantity: { amount: 1, unit: 'piece' }, location: 'fridge', category: 'Laitier', expiresAt: soon })
    await client
      .post('/api/products')
      .headers({ cookie })
      .json({ name: 'Conserve', quantity: { amount: 1, unit: 'piece' }, location: 'pantry', category: 'Épicerie', expiresAt: far })

    const response = await client.get('/api/products/expiring-soon?days=3').headers({ cookie })
    response.assertStatus(200)
    assert.lengthOf(response.body().products, 1)
    assert.equal(response.body().products[0].name, 'Yaourt')
  })

  test('lookup returns the mapped result for a found barcode', async ({ client, cleanup }) => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ status: 1, product: { product_name: 'Nutella', categories_tags: ['en:spreads'] } }),
      )) as typeof fetch
    cleanup(() => {
      globalThis.fetch = originalFetch
    })

    const cookie = await signUpWithHousehold(client, 'fridge-lookup@example.com')
    const response = await client.get('/api/products/lookup?barcode=3017620422003').headers({ cookie })
    response.assertStatus(200)
    response.assertBodyContains({ result: { name: 'Nutella', openfoodfactId: '3017620422003' } })
  })

  test('image returns 404 when the product has no imageKey', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'fridge-image@example.com')
    const create = await client
      .post('/api/products')
      .headers({ cookie })
      .json({ name: 'Beurre', quantity: { amount: 1, unit: 'piece' }, location: 'fridge', category: 'Laitier' })
    const productId = create.body().product.id

    const response = await client.get(`/api/products/${productId}/image`).headers({ cookie })
    response.assertStatus(404)
  })

  test('all product routes require a household', async ({ client }) => {
    const signUp = await client
      .post('/api/auth/sign-up/email')
      .json({ email: 'fridge-no-household@example.com', password: 'correct-horse-battery-staple', name: 'Test' })
    const cookie = signUp.headers()['set-cookie']

    const response = await client.get('/api/products').headers({ cookie })
    response.assertStatus(403)
    response.assertBodyContains({ error: { type: 'no_household' } })
  })
})
```

Run: `cd backend && node ace test`
Expected: PASS — all previous tests green, plus 6 new functional tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/application/fridge backend/src/presentation/fridge backend/src/presentation/shared/error-serializer.ts backend/start/routes.ts backend/tests/functional/fridge
git commit -m "feat(fridge): use-cases, HTTP endpoints, functional tests"
```

---

## Task 8: Receipt domain

**Files:**
- Create: `backend/src/domain/receipt/receipt.entity.ts`
- Create: `backend/src/domain/receipt/receipt-draft.ts`
- Create: `backend/src/domain/receipt/receipt-extraction.errors.ts`
- Create: `backend/src/domain/receipt/receipt-draft-parser.ts`
- Create: `backend/src/domain/receipt/interfaces/receipt-repository.interface.ts`
- Create: `backend/src/domain/receipt/interfaces/receipt-extraction-port.interface.ts`
- Test: `backend/tests/unit/domain/receipt/receipt.entity.spec.ts`
- Test: `backend/tests/unit/domain/receipt/receipt-draft-parser.spec.ts`

**Interfaces:**
- Consumes: `AggregateRoot` (Phase 1 Task 4).
- Produces: `Receipt.create(params): Receipt`, `.reconstruct(id, props)`, getters.
  `ReceiptDraft`/`ReceiptDraftItem` interfaces. `ReceiptExtractionUnavailableError`,
  `ReceiptExtractionParseError` — domain-owned exception types Task 9's adapters
  throw and Task 10's `ScanReceipt` use-case catches (kept in `domain`, not
  `infrastructure`, specifically so the application layer can import them without
  breaking the `application-only-depends-on-domain` boundary rule). `parseReceiptDraftJson(text):
  ReceiptDraft` — pure parsing/validation logic, shared by all three AI adapters in
  Task 9 (none of them re-implement it). `ReceiptRepository`, `ReceiptExtractionPort`
  interfaces — implemented in Task 9 (`ReceiptExtractionPort`) and Task 10
  (`ReceiptRepository`).

- [ ] **Step 1: Write the failing tests**

```ts
// backend/tests/unit/domain/receipt/receipt.entity.spec.ts
import { test } from '@japa/runner'
import { Receipt } from '#domain/receipt/receipt.entity'

test.group('Receipt', () => {
  test('create() defaults imageKey to null', ({ assert }) => {
    const receipt = Receipt.create({
      id: 'r_1',
      householdId: 'h_1',
      storeName: 'Carrefour',
      scannedAt: new Date('2026-08-26T18:00:00Z'),
      totalAmount: 23.47,
      itemsCount: 3,
      createdAt: new Date('2026-08-26T18:00:00Z'),
    })
    assert.isNull(receipt.imageKey)
    assert.equal(receipt.itemsCount, 3)
    assert.equal(receipt.storeName, 'Carrefour')
  })
})
```

```ts
// backend/tests/unit/domain/receipt/receipt-draft-parser.spec.ts
import { test } from '@japa/runner'
import { parseReceiptDraftJson } from '#domain/receipt/receipt-draft-parser'
import { ReceiptExtractionParseError } from '#domain/receipt/receipt-extraction.errors'

const VALID_JSON = JSON.stringify({
  storeName: 'Carrefour',
  scannedAt: '2026-08-26T18:00:00Z',
  totalAmount: 4.8,
  items: [{ name: 'Lait 1L', quantity: 2, unit: 'piece', category: 'Produits laitiers', price: 2.4 }],
})

test.group('parseReceiptDraftJson', () => {
  test('parses a well-formed AI response', ({ assert }) => {
    const draft = parseReceiptDraftJson(VALID_JSON)
    assert.equal(draft.storeName, 'Carrefour')
    assert.equal(draft.totalAmount, 4.8)
    assert.lengthOf(draft.items, 1)
    assert.equal(draft.items[0]?.name, 'Lait 1L')
  })

  test('strips a ```json fenced code block some models wrap the response in', ({ assert }) => {
    const draft = parseReceiptDraftJson(`Voici le résultat:\n\`\`\`json\n${VALID_JSON}\n\`\`\``)
    assert.equal(draft.storeName, 'Carrefour')
  })

  test('throws ReceiptExtractionParseError on invalid JSON', ({ assert }) => {
    assert.throws(() => parseReceiptDraftJson('not json'), ReceiptExtractionParseError)
  })

  test('throws ReceiptExtractionParseError when required fields are missing', ({ assert }) => {
    assert.throws(() => parseReceiptDraftJson(JSON.stringify({ storeName: 'X' })), ReceiptExtractionParseError)
  })

  test('throws ReceiptExtractionParseError when an item is missing required fields', ({ assert }) => {
    const badItem = JSON.stringify({
      storeName: 'X',
      scannedAt: '2026-08-26T18:00:00Z',
      totalAmount: 1,
      items: [{ name: 'X' }],
    })
    assert.throws(() => parseReceiptDraftJson(badItem), ReceiptExtractionParseError)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && node ace test unit`
Expected: FAIL with "Cannot find module '#domain/receipt/receipt.entity'" (and
`receipt-draft-parser`, `receipt-extraction.errors`).

- [ ] **Step 3: Implement**

```ts
// backend/src/domain/receipt/receipt.entity.ts
import { AggregateRoot } from '#domain/shared/aggregate-root'

interface ReceiptProps {
  householdId: string
  storeName: string
  scannedAt: Date
  totalAmount: number
  imageKey: string | null
  itemsCount: number
  createdAt: Date
}

export interface CreateReceiptProps {
  id: string
  householdId: string
  storeName: string
  scannedAt: Date
  totalAmount: number
  itemsCount: number
  imageKey?: string | null
  createdAt: Date
}

export class Receipt extends AggregateRoot<string> {
  private props: ReceiptProps

  private constructor(id: string, props: ReceiptProps) {
    super(id)
    this.props = props
  }

  static create(params: CreateReceiptProps): Receipt {
    return new Receipt(params.id, {
      householdId: params.householdId,
      storeName: params.storeName,
      scannedAt: params.scannedAt,
      totalAmount: params.totalAmount,
      itemsCount: params.itemsCount,
      imageKey: params.imageKey ?? null,
      createdAt: params.createdAt,
    })
  }

  static reconstruct(id: string, props: ReceiptProps): Receipt {
    return new Receipt(id, props)
  }

  get householdId(): string {
    return this.props.householdId
  }

  get storeName(): string {
    return this.props.storeName
  }

  get scannedAt(): Date {
    return this.props.scannedAt
  }

  get totalAmount(): number {
    return this.props.totalAmount
  }

  get imageKey(): string | null {
    return this.props.imageKey
  }

  get itemsCount(): number {
    return this.props.itemsCount
  }

  get createdAt(): Date {
    return this.props.createdAt
  }
}
```

```ts
// backend/src/domain/receipt/receipt-draft.ts
/** Never persisted as-is — the raw result of `ReceiptExtractionPort.extract()`. */
export interface ReceiptDraftItem {
  name: string
  quantity: number
  unit: string
  category: string | null
  price: number | null
}

export interface ReceiptDraft {
  storeName: string
  scannedAt: Date
  totalAmount: number
  items: ReceiptDraftItem[]
}
```

```ts
// backend/src/domain/receipt/receipt-extraction.errors.ts
/**
 * Domain-owned (not infrastructure-owned) specifically so the application
 * layer can import these without violating the `application-only-depends-
 * on-domain` dependency-cruiser rule — Task 9's three AI adapters throw
 * them, Task 10's `ScanReceipt` use-case catches them.
 */
export class ReceiptExtractionUnavailableError extends Error {
  constructor(public readonly provider: string) {
    super(`Receipt extraction provider "${provider}" has no credentials configured.`)
  }
}

export class ReceiptExtractionParseError extends Error {}
```

```ts
// backend/src/domain/receipt/receipt-draft-parser.ts
import type { ReceiptDraft, ReceiptDraftItem } from './receipt-draft.js'
import { ReceiptExtractionParseError } from './receipt-extraction.errors.js'

interface RawReceiptDraft {
  storeName?: unknown
  scannedAt?: unknown
  totalAmount?: unknown
  items?: unknown
}

/** Models sometimes wrap JSON in a ```json fenced block despite instructions — strip it. */
function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced ? fenced[1].trim() : text.trim()
}

function parseItem(item: unknown, index: number): ReceiptDraftItem {
  if (typeof item !== 'object' || item === null) {
    throw new ReceiptExtractionParseError(`item ${index} is not an object`)
  }
  const record = item as Record<string, unknown>
  if (typeof record.name !== 'string' || typeof record.quantity !== 'number' || typeof record.unit !== 'string') {
    throw new ReceiptExtractionParseError(`item ${index} is missing required fields`)
  }
  return {
    name: record.name,
    quantity: record.quantity,
    unit: record.unit,
    category: typeof record.category === 'string' ? record.category : null,
    price: typeof record.price === 'number' ? record.price : null,
  }
}

/**
 * Turns a vision model's raw text response into a validated `ReceiptDraft`
 * — shared by all three `ReceiptExtractionPort` adapters (Task 9), so the
 * extraction prompt's contract is validated in exactly one place.
 */
export function parseReceiptDraftJson(text: string): ReceiptDraft {
  const jsonText = extractJsonBlock(text)
  let raw: RawReceiptDraft
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new ReceiptExtractionParseError('AI response was not valid JSON')
  }

  if (
    typeof raw.storeName !== 'string' ||
    typeof raw.scannedAt !== 'string' ||
    typeof raw.totalAmount !== 'number' ||
    !Array.isArray(raw.items)
  ) {
    throw new ReceiptExtractionParseError('AI response is missing required receipt fields')
  }

  return {
    storeName: raw.storeName,
    scannedAt: new Date(raw.scannedAt),
    totalAmount: raw.totalAmount,
    items: raw.items.map(parseItem),
  }
}
```

```ts
// backend/src/domain/receipt/interfaces/receipt-repository.interface.ts
import type { Receipt } from '../receipt.entity.js'

export interface ReceiptRepository {
  findById(id: string): Promise<Receipt | null>
  findByHousehold(householdId: string): Promise<Receipt[]>
  save(receipt: Receipt): Promise<void>
}
```

```ts
// backend/src/domain/receipt/interfaces/receipt-extraction-port.interface.ts
import type { ReceiptDraft } from '../receipt-draft.js'

export interface ReceiptExtractionPort {
  extract(image: Buffer): Promise<ReceiptDraft>
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && node ace test unit`
Expected: PASS (6 new tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/receipt backend/tests/unit/domain/receipt
git commit -m "feat(receipt): domain (Receipt, ReceiptDraft, extraction parser/errors)"
```

---

## Task 9: AI provider registry + 3 `ReceiptExtractionPort` adapters

**Files:**
- Create: `backend/src/infrastructure/settings/gemini-receipt-extraction.adapter.ts`
- Create: `backend/src/infrastructure/settings/openai-receipt-extraction.adapter.ts`
- Create: `backend/src/infrastructure/settings/ollama-receipt-extraction.adapter.ts`
- Create: `backend/src/infrastructure/settings/ai-provider-registry.ts`
- Modify: `backend/start/env.ts` (add `OLLAMA_VISION_MODEL`)
- Modify: `.env.example`, `backend/.env`
- Test: `backend/tests/infrastructure/settings/ai-provider-registry.spec.ts`

**Interfaces:**
- Consumes: `ReceiptExtractionPort`, `ReceiptDraft`, `ReceiptExtractionUnavailableError`,
  `parseReceiptDraftJson` (Task 8). `AiSettingsProvider`, `AiProvider` (Task 1).
- Produces: `GeminiReceiptExtractionAdapter`, `OpenAiReceiptExtractionAdapter`,
  `OllamaReceiptExtractionAdapter` — each `implements ReceiptExtractionPort`.
  `resolveReceiptExtractionAdapter(settings: AiSettingsProvider): Promise<ReceiptExtractionPort>`
  — consumed by Task 10 via the `settings.resolveReceiptExtractionPort` binding
  (registered in Task 10, since that's where the receipt controller that needs it
  lives). `__setReceiptExtractionOverrideForTests(port | null)` — test-only seam,
  consumed by Task 10's functional test.

- [ ] **Step 1: Install the two SDKs**

```bash
cd backend && pnpm add @google/genai openai
```

- [ ] **Step 2: The three adapters**

Same extraction prompt for all three — defined once per adapter file since each
SDK's call shape differs enough that sharing it as an imported constant would add
more indirection than it saves (three short literals, easy to eyeball for drift).

```ts
// backend/src/infrastructure/settings/gemini-receipt-extraction.adapter.ts
import { GoogleGenAI } from '@google/genai'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import { parseReceiptDraftJson } from '#domain/receipt/receipt-draft-parser'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'

const EXTRACTION_PROMPT = `Analyse cette photo de ticket de caisse et retourne UNIQUEMENT un JSON de la forme :
{"storeName": string, "scannedAt": string (ISO 8601), "totalAmount": number, "items": [{"name": string, "quantity": number, "unit": string, "category": string | null, "price": number | null}]}
Pas de texte hors du JSON.`

export class GeminiReceiptExtractionAdapter implements ReceiptExtractionPort {
  constructor(private readonly apiKey: string) {}

  async extract(image: Buffer): Promise<ReceiptDraft> {
    if (!this.apiKey) throw new ReceiptExtractionUnavailableError('gemini')

    const client = new GoogleGenAI({ apiKey: this.apiKey })
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: EXTRACTION_PROMPT },
            { inlineData: { mimeType: 'image/jpeg', data: image.toString('base64') } },
          ],
        },
      ],
    })

    return parseReceiptDraftJson(response.text ?? '')
  }
}
```

```ts
// backend/src/infrastructure/settings/openai-receipt-extraction.adapter.ts
import OpenAI from 'openai'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import { parseReceiptDraftJson } from '#domain/receipt/receipt-draft-parser'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'

const EXTRACTION_PROMPT = `Analyse cette photo de ticket de caisse et retourne UNIQUEMENT un JSON de la forme :
{"storeName": string, "scannedAt": string (ISO 8601), "totalAmount": number, "items": [{"name": string, "quantity": number, "unit": string, "category": string | null, "price": number | null}]}
Pas de texte hors du JSON.`

export class OpenAiReceiptExtractionAdapter implements ReceiptExtractionPort {
  constructor(private readonly apiKey: string) {}

  async extract(image: Buffer): Promise<ReceiptDraft> {
    if (!this.apiKey) throw new ReceiptExtractionUnavailableError('openai')

    const client = new OpenAI({ apiKey: this.apiKey })
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` } },
          ],
        },
      ],
    })

    return parseReceiptDraftJson(response.choices[0]?.message.content ?? '')
  }
}
```

```ts
// backend/src/infrastructure/settings/ollama-receipt-extraction.adapter.ts
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import { parseReceiptDraftJson } from '#domain/receipt/receipt-draft-parser'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'

const EXTRACTION_PROMPT = `Analyse cette photo de ticket de caisse et retourne UNIQUEMENT un JSON de la forme :
{"storeName": string, "scannedAt": string (ISO 8601), "totalAmount": number, "items": [{"name": string, "quantity": number, "unit": string, "category": string | null, "price": number | null}]}
Pas de texte hors du JSON.`

export class OllamaReceiptExtractionAdapter implements ReceiptExtractionPort {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async extract(image: Buffer): Promise<ReceiptDraft> {
    if (!this.model) throw new ReceiptExtractionUnavailableError('ollama')

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: EXTRACTION_PROMPT,
        images: [image.toString('base64')],
        stream: false,
      }),
    })
    if (!response.ok) throw new ReceiptExtractionUnavailableError('ollama')

    const body = (await response.json()) as { response?: string }
    return parseReceiptDraftJson(body.response ?? '')
  }
}
```

- [ ] **Step 3: Write the failing registry test**

```ts
// backend/tests/infrastructure/settings/ai-provider-registry.spec.ts
import { test } from '@japa/runner'
import { resolveReceiptExtractionAdapter } from '#infrastructure/settings/ai-provider-registry'
import { GeminiReceiptExtractionAdapter } from '#infrastructure/settings/gemini-receipt-extraction.adapter'
import { OllamaReceiptExtractionAdapter } from '#infrastructure/settings/ollama-receipt-extraction.adapter'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { AiProvider } from '#domain/settings/ai-provider.vo'

function fakeSettings(provider: AiProvider): AiSettingsProvider {
  return {
    async resolveEffective() {
      return { activeProvider: provider, source: 'environment', availableProviders: [provider] }
    },
  }
}

test.group('resolveReceiptExtractionAdapter (ai-provider-registry)', () => {
  test('returns the same adapter instance when the provider is unchanged', async ({ assert }) => {
    const settings = fakeSettings('gemini')
    const first = await resolveReceiptExtractionAdapter(settings)
    const second = await resolveReceiptExtractionAdapter(settings)
    assert.strictEqual(first, second)
    assert.instanceOf(first, GeminiReceiptExtractionAdapter)
  })

  test('rebuilds the adapter when the provider changes', async ({ assert }) => {
    await resolveReceiptExtractionAdapter(fakeSettings('gemini'))
    const afterSwitch = await resolveReceiptExtractionAdapter(fakeSettings('ollama'))
    assert.instanceOf(afterSwitch, OllamaReceiptExtractionAdapter)
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd backend && node ace test unit`
Expected: FAIL with "Cannot find module '#infrastructure/settings/ai-provider-registry'".

- [ ] **Step 5: Implement the registry**

```ts
// backend/src/infrastructure/settings/ai-provider-registry.ts
import env from '#start/env'
import { GeminiReceiptExtractionAdapter } from './gemini-receipt-extraction.adapter.js'
import { OpenAiReceiptExtractionAdapter } from './openai-receipt-extraction.adapter.js'
import { OllamaReceiptExtractionAdapter } from './ollama-receipt-extraction.adapter.js'
import type { AiSettingsProvider } from '#domain/settings/interfaces/ai-settings-provider.interface'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { AiProvider } from '#domain/settings/ai-provider.vo'

let cached: { adapter: ReceiptExtractionPort; signature: AiProvider } | null = null
let testOverride: ReceiptExtractionPort | null = null

/**
 * Test-only seam — when set, `resolveReceiptExtractionAdapter` short-
 * circuits to it instead of resolving env/DB-backed settings and
 * constructing a real SDK client. Never call this outside a test; the name
 * is prefixed `__` specifically to stand out at call sites.
 */
export function __setReceiptExtractionOverrideForTests(port: ReceiptExtractionPort | null): void {
  testOverride = port
  cached = null
}

function buildAdapter(provider: AiProvider): ReceiptExtractionPort {
  switch (provider) {
    case 'gemini':
      return new GeminiReceiptExtractionAdapter(env.get('GEMINI_API_KEY', ''))
    case 'openai':
      return new OpenAiReceiptExtractionAdapter(env.get('OPENAI_API_KEY', ''))
    case 'ollama':
      return new OllamaReceiptExtractionAdapter(
        env.get('OLLAMA_BASE_URL', 'http://localhost:11434'),
        env.get('OLLAMA_VISION_MODEL', ''),
      )
  }
}

/**
 * Cheap DB read on every call (via `settings.resolveEffective()`), no
 * adapter rebuild unless `activeProvider` actually changed — same
 * hot-reload mechanism `arr` uses for `getAuthInstance`
 * (`~/dev/arr/backend/src/infrastructure/auth/better-auth/instance.ts:163-181`).
 */
export async function resolveReceiptExtractionAdapter(
  settings: AiSettingsProvider,
): Promise<ReceiptExtractionPort> {
  if (testOverride) return testOverride

  const effective = await settings.resolveEffective()
  if (!cached || cached.signature !== effective.activeProvider) {
    cached = { adapter: buildAdapter(effective.activeProvider), signature: effective.activeProvider }
  }
  return cached.adapter
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && node ace test unit`
Expected: PASS (2 new tests).

- [ ] **Step 7: Env var**

```ts
// backend/start/env.ts — add:
  OLLAMA_VISION_MODEL: Env.schema.string.optional(),
```

```bash
# .env.example and backend/.env — append to the AI provider section:
# OLLAMA_VISION_MODEL=llava   # must be a vision-capable model (cf. docs/adr/0006)
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/infrastructure/settings backend/start/env.ts backend/tests/infrastructure/settings .env.example backend/.env backend/package.json backend/pnpm-lock.yaml
git commit -m "feat(settings): Gemini/OpenAI/Ollama receipt extraction adapters, hot-reload registry"
```

---

## Task 10: Receipt persistence + use-cases + HTTP

**Files:**
- Create: `backend/src/infrastructure/database/receipt/receipt.lucid.ts`
- Create: `backend/src/infrastructure/database/receipt/receipt.mapper.ts`
- Create: `backend/src/infrastructure/database/receipt/receipt.repository.ts`
- Create: `backend/providers/receipt_provider.ts`
- Modify: `backend/providers/settings_provider.ts` (add `settings.resolveReceiptExtractionPort`)
- Modify: `backend/adonisrc.ts` (register `ReceiptProvider`)
- Modify: `backend/src/domain/fridge/interfaces/product-repository.interface.ts` (add `findByReceiptId`)
- Modify: `backend/src/infrastructure/database/fridge/product.repository.ts` (implement it)
- Create: `backend/src/application/receipt/scan-receipt.use-case.ts`
- Create: `backend/src/application/receipt/import-receipt.use-case.ts`
- Create: `backend/src/application/receipt/get-receipt.use-case.ts`
- Create: `backend/src/application/receipt/list-receipts.use-case.ts`
- Create: `backend/src/presentation/receipt/receipt.dto.ts`
- Create: `backend/src/presentation/receipt/receipt.validator.ts`
- Create: `backend/src/presentation/receipt/receipt.controller.ts`
- Create: `backend/src/presentation/receipt/receipt.routes.ts`
- Modify: `backend/src/presentation/shared/error-serializer.ts`
- Modify: `backend/start/routes.ts`
- Test: `backend/tests/infrastructure/receipt/receipt.repository.spec.ts`
- Test: `backend/tests/functional/receipt/receipt.spec.ts`

**Interfaces:**
- Consumes: `Receipt`, `ReceiptDraft`, `ReceiptExtractionUnavailableError`,
  `ReceiptExtractionParseError`, `ReceiptRepository`, `ReceiptExtractionPort`
  (Task 8). `resolveReceiptExtractionAdapter`, `__setReceiptExtractionOverrideForTests`
  (Task 9). `ProductRepository`, `Product`, `Quantity`, `Location` (Task 4/5).
- Produces: `POST /api/receipts/scan`, `POST /api/receipts/import`,
  `GET /api/receipts`, `GET /api/receipts/:id`, `GET /api/receipts/:id/image` —
  matching `docs/phase-0/04-endpoints-http.md`.

- [ ] **Step 1: Extend `ProductRepository` with `findByReceiptId`**

Not in the domain doc's original port listing — added here because the receipt
detail endpoint (`GET /api/receipts/:id`) needs "products via `receiptId`"
(`docs/phase-0/04-endpoints-http.md`), and no existing method covers it.

```ts
// backend/src/domain/fridge/interfaces/product-repository.interface.ts — add to the interface:
  findByReceiptId(receiptId: string): Promise<Product[]>
```

```ts
// backend/src/infrastructure/database/fridge/product.repository.ts — add the method:
  async findByReceiptId(receiptId: string): Promise<Product[]> {
    const rows = await ProductModel.query().where('receipt_id', receiptId)
    return rows.map(toDomain)
  }
```

- [ ] **Step 2: Receipt persistence**

```ts
// backend/src/infrastructure/database/receipt/receipt.lucid.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class ReceiptModel extends BaseModel {
  static table = 'receipt'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'store_name' })
  declare storeName: string

  @column.dateTime({ columnName: 'scanned_at' })
  declare scannedAt: DateTime

  @column({ columnName: 'total_amount' })
  declare totalAmount: number

  @column({ columnName: 'image_key' })
  declare imageKey: string | null

  @column({ columnName: 'items_count' })
  declare itemsCount: number

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

```ts
// backend/src/infrastructure/database/receipt/receipt.mapper.ts
import { Receipt } from '#domain/receipt/receipt.entity'
import type ReceiptModel from './receipt.lucid.js'

export function toDomain(row: ReceiptModel): Receipt {
  return Receipt.reconstruct(row.id, {
    householdId: row.householdId,
    storeName: row.storeName,
    scannedAt: row.scannedAt.toJSDate(),
    totalAmount: row.totalAmount,
    imageKey: row.imageKey,
    itemsCount: row.itemsCount,
    createdAt: row.createdAt.toJSDate(),
  })
}
```

```ts
// backend/src/infrastructure/database/receipt/receipt.repository.ts
import { DateTime } from 'luxon'
import ReceiptModel from './receipt.lucid.js'
import { toDomain } from './receipt.mapper.js'
import type { ReceiptRepository } from '#domain/receipt/interfaces/receipt-repository.interface'
import type { Receipt } from '#domain/receipt/receipt.entity'

export class LucidReceiptRepository implements ReceiptRepository {
  async findById(id: string): Promise<Receipt | null> {
    const row = await ReceiptModel.find(id)
    return row ? toDomain(row) : null
  }

  async findByHousehold(householdId: string): Promise<Receipt[]> {
    const rows = await ReceiptModel.query().where('household_id', householdId).orderBy('scanned_at', 'desc')
    return rows.map(toDomain)
  }

  async save(receipt: Receipt): Promise<void> {
    await ReceiptModel.updateOrCreate(
      { id: receipt.id },
      {
        householdId: receipt.householdId,
        storeName: receipt.storeName,
        scannedAt: DateTime.fromJSDate(receipt.scannedAt),
        totalAmount: receipt.totalAmount,
        imageKey: receipt.imageKey,
        itemsCount: receipt.itemsCount,
      },
    )
  }
}
```

```ts
// backend/providers/receipt_provider.ts
import type { ApplicationService } from '@adonisjs/core/types'
import type { ReceiptRepository } from '#domain/receipt/interfaces/receipt-repository.interface'

export default class ReceiptProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('receipt.receipts', async () => {
      const { LucidReceiptRepository } = await import('#infrastructure/database/receipt/receipt.repository')
      return new LucidReceiptRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'receipt.receipts': ReceiptRepository
  }
}
```

```ts
// backend/adonisrc.ts — add to the `providers` array, after '#providers/fridge_provider':
    () => import('#providers/receipt_provider'),
```

- [ ] **Step 3: `settings.resolveReceiptExtractionPort` binding**

```ts
// backend/providers/settings_provider.ts — add the import and binding:
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'

// inside register(), alongside the existing settings.* singletons:
    this.app.container.singleton('settings.resolveReceiptExtractionPort', async () => {
      const { resolveReceiptExtractionAdapter } = await import('#infrastructure/settings/ai-provider-registry')
      const aiSettingsProvider = await this.app.container.make('settings.aiSettingsProvider')
      return () => resolveReceiptExtractionAdapter(aiSettingsProvider)
    })

// inside the ContainerBindings interface augmentation:
    'settings.resolveReceiptExtractionPort': () => Promise<ReceiptExtractionPort>
```

This indirection (a binding that returns a *function*, not the port directly) is
why `ReceiptController` never imports `#infrastructure/settings/ai-provider-registry`
itself — that import would violate `presentation-must-not-depend-on-infrastructure`.
The binding lives in `providers/`, outside `src/`, exactly where Phase 1's
`identity.authHandler` binding put the same kind of indirection.

- [ ] **Step 4: Infrastructure test**

```ts
// backend/tests/infrastructure/receipt/receipt.repository.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidReceiptRepository } from '#infrastructure/database/receipt/receipt.repository'
import { Receipt } from '#domain/receipt/receipt.entity'

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

test.group('LucidReceiptRepository', (group) => {
  group.each.setup(() => db.beginGlobalTransaction())
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('save() then findById()/findByHousehold() round-trip a receipt', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    await createHousehold('h_1', 'u_1')

    const repository = new LucidReceiptRepository()
    const receipt = Receipt.create({
      id: 'r_1',
      householdId: 'h_1',
      storeName: 'Carrefour',
      scannedAt: new Date(),
      totalAmount: 12.5,
      itemsCount: 2,
      createdAt: new Date(),
    })
    await repository.save(receipt)

    const found = await repository.findById('r_1')
    assert.equal(found?.storeName, 'Carrefour')

    const byHousehold = await repository.findByHousehold('h_1')
    assert.lengthOf(byHousehold, 1)
  })
})
```

Run: `cd backend && node ace test unit`
Expected: PASS (1 new test).

- [ ] **Step 5: Use-cases**

```ts
// backend/src/application/receipt/scan-receipt.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import { ReceiptExtractionUnavailableError, ReceiptExtractionParseError } from '#domain/receipt/receipt-extraction.errors'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export type ScanReceiptError = 'provider_not_configured' | 'extraction_failed'

export class ScanReceipt implements UseCase<{ image: Buffer }, ResultType<ReceiptDraft, ScanReceiptError>> {
  constructor(private readonly extraction: ReceiptExtractionPort) {}

  async execute(input: { image: Buffer }): Promise<ResultType<ReceiptDraft, ScanReceiptError>> {
    try {
      const draft = await this.extraction.extract(input.image)
      return Result.ok(draft)
    } catch (error) {
      if (error instanceof ReceiptExtractionUnavailableError) return Result.err('provider_not_configured')
      if (error instanceof ReceiptExtractionParseError) return Result.err('extraction_failed')
      throw error
    }
  }
}
```

```ts
// backend/src/application/receipt/import-receipt.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { ReceiptRepository } from '#domain/receipt/interfaces/receipt-repository.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Receipt } from '#domain/receipt/receipt.entity'
import { Product } from '#domain/fridge/product.entity'
import { Quantity } from '#domain/fridge/quantity.vo'
import { Location } from '#domain/fridge/location.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

export interface ImportReceiptItemInput {
  name: string
  quantity: number
  unit: string
  category: string | null
  price: number | null
  location: string
  expiresAt: Date | null
}

export interface ImportReceiptInput {
  householdId: string
  storeName: string
  scannedAt: Date
  totalAmount: number
  imageKey: string | null
  items: ImportReceiptItemInput[]
}

export interface ImportReceiptOutput {
  receipt: Receipt
  products: Product[]
}

/**
 * Saves the receipt, then each product — sequential, not one DB transaction
 * spanning both aggregates (`ReceiptRepository`/`ProductRepository` don't
 * expose a shared unit-of-work, matching the ports as specified in
 * docs/phase-0/02-modele-de-domaine.md). A crash between the receipt save
 * and the last product save leaves a receipt with fewer products than
 * `itemsCount` claims — recoverable by re-import, not auto-healed. Flagged
 * here rather than solved: acceptable for a single-instance self-hosted app,
 * revisit if this ever needs to be bulletproof.
 */
export class ImportReceipt
  implements UseCase<ImportReceiptInput, ResultType<ImportReceiptOutput, ValidationError>>
{
  constructor(
    private readonly receipts: ReceiptRepository,
    private readonly products: ProductRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: ImportReceiptInput): Promise<ResultType<ImportReceiptOutput, ValidationError>> {
    const now = this.clock.now()
    const receipt = Receipt.create({
      id: this.idGenerator.next(),
      householdId: input.householdId,
      storeName: input.storeName,
      scannedAt: input.scannedAt,
      totalAmount: input.totalAmount,
      itemsCount: input.items.length,
      imageKey: input.imageKey,
      createdAt: now,
    })

    const products: Product[] = []
    for (const item of input.items) {
      const quantity = Quantity.create(item.quantity, item.unit)
      if (!quantity.ok) return quantity

      const location = Location.create(item.location)
      if (!location.ok) return location

      products.push(
        Product.create({
          id: this.idGenerator.next(),
          householdId: input.householdId,
          receiptId: receipt.id,
          name: item.name,
          quantity: quantity.value,
          location: location.value,
          category: item.category ?? 'Non catégorisé',
          expiresAt: item.expiresAt,
          price: item.price,
          createdAt: now,
        }),
      )
    }

    await this.receipts.save(receipt)
    for (const product of products) {
      await this.products.save(product)
    }

    return Result.ok({ receipt, products })
  }
}
```

```ts
// backend/src/application/receipt/get-receipt.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { ReceiptRepository } from '#domain/receipt/interfaces/receipt-repository.interface'
import type { ProductRepository } from '#domain/fridge/interfaces/product-repository.interface'
import type { Receipt } from '#domain/receipt/receipt.entity'
import type { Product } from '#domain/fridge/product.entity'

export interface GetReceiptInput {
  householdId: string
  receiptId: string
}

export interface GetReceiptOutput {
  receipt: Receipt
  products: Product[]
}

export class GetReceipt implements UseCase<GetReceiptInput, GetReceiptOutput | null> {
  constructor(
    private readonly receipts: ReceiptRepository,
    private readonly products: ProductRepository,
  ) {}

  async execute(input: GetReceiptInput): Promise<GetReceiptOutput | null> {
    const receipt = await this.receipts.findById(input.receiptId)
    if (!receipt || receipt.householdId !== input.householdId) return null

    const products = await this.products.findByReceiptId(receipt.id)
    return { receipt, products }
  }
}
```

```ts
// backend/src/application/receipt/list-receipts.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { ReceiptRepository } from '#domain/receipt/interfaces/receipt-repository.interface'
import type { Receipt } from '#domain/receipt/receipt.entity'

export interface ListReceiptsInput {
  householdId: string
}

export class ListReceipts implements UseCase<ListReceiptsInput, Receipt[]> {
  constructor(private readonly receipts: ReceiptRepository) {}

  async execute(input: ListReceiptsInput): Promise<Receipt[]> {
    return this.receipts.findByHousehold(input.householdId)
  }
}
```

- [ ] **Step 6: DTO, validator**

```ts
// backend/src/presentation/receipt/receipt.dto.ts
import type { Receipt } from '#domain/receipt/receipt.entity'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'

export interface ReceiptDraftDto {
  storeName: string
  scannedAt: string
  totalAmount: number
  items: { name: string; quantity: number; unit: string; category: string | null; price: number | null }[]
}

export interface ReceiptDto {
  id: string
  storeName: string
  scannedAt: string
  totalAmount: number
  imageKey: string | null
  itemsCount: number
  createdAt: string
}

export function toReceiptDraftDto(draft: ReceiptDraft): ReceiptDraftDto {
  return {
    storeName: draft.storeName,
    scannedAt: draft.scannedAt.toISOString(),
    totalAmount: draft.totalAmount,
    items: draft.items,
  }
}

export function toReceiptDto(receipt: Receipt): ReceiptDto {
  return {
    id: receipt.id,
    storeName: receipt.storeName,
    scannedAt: receipt.scannedAt.toISOString(),
    totalAmount: receipt.totalAmount,
    imageKey: receipt.imageKey,
    itemsCount: receipt.itemsCount,
    createdAt: receipt.createdAt.toISOString(),
  }
}
```

```ts
// backend/src/presentation/receipt/receipt.validator.ts
import vine from '@vinejs/vine'

export const importReceiptValidator = vine.compile(
  vine.object({
    storeName: vine.string().trim().minLength(1).maxLength(120),
    scannedAt: vine.date(),
    totalAmount: vine.number().positive(),
    imageKey: vine.string().trim().optional(),
    items: vine
      .array(
        vine.object({
          name: vine.string().trim().minLength(1),
          quantity: vine.number().positive(),
          unit: vine.string().trim().minLength(1),
          category: vine.string().trim().optional(),
          price: vine.number().positive().optional(),
          location: vine.enum(['fridge', 'freezer', 'pantry'] as const),
          expiresAt: vine.date().optional(),
        }),
      )
      .minLength(1),
  }),
)
```

- [ ] **Step 7: Controller, routes**

```ts
// backend/src/presentation/receipt/receipt.controller.ts
import { readFile } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
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
    const image = ctx.request.file('image')
    if (!image || !image.tmpPath) {
      const { status, body } = serializeError('extraction_failed')
      return ctx.response.status(status).json(body)
    }

    const buffer = await readFile(image.tmpPath)
    const resolveExtraction = await ctx.containerResolver.make('settings.resolveReceiptExtractionPort')
    const extraction = await resolveExtraction()

    const result = await new ScanReceipt(extraction).execute({ image: buffer })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({ draft: toReceiptDraftDto(result.value) })
  }

  async importReceipt(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
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
      imageKey: payload.imageKey ?? null,
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
      return ctx.response.status(status).json(body)
    }

    return ctx.response.status(201).json({
      receipt: toReceiptDto(result.value.receipt),
      products: result.value.products.map(toProductDto),
    })
  }

  async index(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const receipts = await ctx.containerResolver.make('receipt.receipts')
    const result = await new ListReceipts(receipts).execute({ householdId: ctx.household.id })
    return ctx.response.json({ receipts: result.map(toReceiptDto) })
  }

  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const receipts = await ctx.containerResolver.make('receipt.receipts')
    const products = await ctx.containerResolver.make('fridge.products')
    const result = await new GetReceipt(receipts, products).execute({
      householdId: ctx.household.id,
      receiptId: ctx.params.id,
    })
    if (!result) {
      const { status, body } = serializeError('receipt_not_found')
      return ctx.response.status(status).json(body)
    }
    return ctx.response.json({
      receipt: toReceiptDto(result.receipt),
      products: result.products.map(toProductDto),
    })
  }

  async image(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const receipts = await ctx.containerResolver.make('receipt.receipts')
    const receipt = await receipts.findById(ctx.params.id)
    if (!receipt || receipt.householdId !== ctx.household.id || !receipt.imageKey) {
      const { status, body } = serializeError('image_not_found')
      return ctx.response.status(status).json(body)
    }

    const storage = await ctx.containerResolver.make('shared.storage')
    const file = await storage.read(receipt.imageKey)
    if (!file) {
      const { status, body } = serializeError('image_not_found')
      return ctx.response.status(status).json(body)
    }

    ctx.response.header('Content-Type', file.contentType)
    return ctx.response.send(file.buffer)
  }
}
```

```ts
// backend/src/presentation/receipt/receipt.routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ReceiptController = () => import('./receipt.controller.js')

router
  .group(() => {
    router.post('/receipts/scan', [ReceiptController, 'scan'])
    router.post('/receipts/import', [ReceiptController, 'importReceipt'])
    router.get('/receipts', [ReceiptController, 'index'])
    router.get('/receipts/:id', [ReceiptController, 'show'])
    router.get('/receipts/:id/image', [ReceiptController, 'image'])
  })
  .prefix('/api')
  .use([middleware.householdRequired()])
```

```ts
// backend/start/routes.ts
import '#presentation/health.routes'
import '#presentation/identity/auth.routes'
import '#presentation/identity/household.routes'
import '#presentation/settings/ai-settings.routes'
import '#presentation/fridge/product.routes'
import '#presentation/receipt/receipt.routes'
```

```ts
// backend/src/presentation/shared/error-serializer.ts — add to both maps:
  receipt_not_found: 404,
  extraction_failed: 422,
  // ...
  receipt_not_found: 'Ticket introuvable.',
  extraction_failed: "L'extraction du ticket a échoué — réessayez avec une photo plus nette.",
```

- [ ] **Step 8: Functional test — scan → import → list/detail, using the fake extraction port**

```ts
// backend/tests/functional/receipt/receipt.spec.ts
import { test } from '@japa/runner'
import { __setReceiptExtractionOverrideForTests } from '#infrastructure/settings/ai-provider-registry'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'

const fakeDraft = {
  storeName: 'Carrefour',
  scannedAt: new Date('2026-08-26T18:00:00Z'),
  totalAmount: 4.8,
  items: [{ name: 'Lait 1L', quantity: 2, unit: 'piece', category: 'Produits laitiers', price: 2.4 }],
}

const fakeExtraction: ReceiptExtractionPort = {
  async extract() {
    return fakeDraft
  },
}

async function signUpWithHousehold(client: import('@japa/api-client').ApiClient, email: string) {
  const signUp = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name: 'Test' })
  const cookie = signUp.headers()['set-cookie']
  if (!cookie) throw new Error('set-cookie header missing')
  await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer receipts' })
  return cookie
}

test.group('receipt: scan, import, list, detail', (group) => {
  group.each.setup(() => {
    __setReceiptExtractionOverrideForTests(fakeExtraction)
    return () => __setReceiptExtractionOverrideForTests(null)
  })

  test('scan returns the fake draft', async ({ client, assert }) => {
    const cookie = await signUpWithHousehold(client, 'receipt-scan@example.com')
    const response = await client
      .post('/api/receipts/scan')
      .headers({ cookie })
      .file('image', Buffer.from('fake-jpeg-bytes'), { filename: 'ticket.jpg' })
    response.assertStatus(200)
    response.assertBodyContains({ draft: { storeName: 'Carrefour', totalAmount: 4.8 } })
  })

  test('scan with no file returns 422', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'receipt-scan-empty@example.com')
    const response = await client.post('/api/receipts/scan').headers({ cookie })
    response.assertStatus(422)
  })

  test('import creates the receipt and its products, list/detail reflect them', async ({
    client,
    assert,
  }) => {
    const cookie = await signUpWithHousehold(client, 'receipt-import@example.com')

    const importResponse = await client
      .post('/api/receipts/import')
      .headers({ cookie })
      .json({
        storeName: 'Carrefour',
        scannedAt: '2026-08-26T18:00:00Z',
        totalAmount: 4.8,
        items: [
          {
            name: 'Lait 1L',
            quantity: 2,
            unit: 'piece',
            category: 'Produits laitiers',
            price: 2.4,
            location: 'fridge',
          },
        ],
      })
    importResponse.assertStatus(201)
    assert.lengthOf(importResponse.body().products, 1)
    const receiptId = importResponse.body().receipt.id

    const list = await client.get('/api/receipts').headers({ cookie })
    assert.lengthOf(list.body().receipts, 1)

    const detail = await client.get(`/api/receipts/${receiptId}`).headers({ cookie })
    detail.assertBodyContains({ receipt: { storeName: 'Carrefour' } })
    assert.lengthOf(detail.body().products, 1)
    assert.equal(detail.body().products[0].receiptId, receiptId)

    const productsList = await client.get('/api/products').headers({ cookie })
    assert.lengthOf(productsList.body().products, 1)
  })

  test('receipt image returns 404 when no imageKey was set on import', async ({ client }) => {
    const cookie = await signUpWithHousehold(client, 'receipt-image@example.com')
    const importResponse = await client
      .post('/api/receipts/import')
      .headers({ cookie })
      .json({
        storeName: 'Carrefour',
        scannedAt: '2026-08-26T18:00:00Z',
        totalAmount: 1,
        items: [{ name: 'Item', quantity: 1, unit: 'piece', location: 'pantry' }],
      })
    const receiptId = importResponse.body().receipt.id

    const response = await client.get(`/api/receipts/${receiptId}/image`).headers({ cookie })
    response.assertStatus(404)
  })
})
```

Run: `cd backend && node ace test`
Expected: PASS — every prior test still green, plus 1 infrastructure + 4
functional new tests.

- [ ] **Step 9: Commit**

```bash
git add backend/src/infrastructure/database/receipt backend/src/infrastructure/database/fridge backend/src/domain/fridge/interfaces/product-repository.interface.ts backend/providers/receipt_provider.ts backend/providers/settings_provider.ts backend/adonisrc.ts backend/src/application/receipt backend/src/presentation/receipt backend/src/presentation/shared/error-serializer.ts backend/start/routes.ts backend/tests/infrastructure/receipt backend/tests/functional/receipt
git commit -m "feat(receipt): persistence, use-cases, HTTP endpoints, functional tests"
```

---

## Task 11: Bruno requests + boundary-lint recheck

**Files:**
- Create: `backend/bruno/settings/get-ai-settings.bru`
- Create: `backend/bruno/settings/patch-ai-settings.bru`
- Create: `backend/bruno/fridge/create-product.bru`
- Create: `backend/bruno/fridge/list-products.bru`
- Create: `backend/bruno/fridge/get-product.bru`
- Create: `backend/bruno/fridge/update-product.bru`
- Create: `backend/bruno/fridge/delete-product.bru`
- Create: `backend/bruno/fridge/expiring-soon.bru`
- Create: `backend/bruno/fridge/lookup-product.bru`
- Create: `backend/bruno/receipt/scan-receipt.bru`
- Create: `backend/bruno/receipt/import-receipt.bru`
- Create: `backend/bruno/receipt/list-receipts.bru`
- Create: `backend/bruno/receipt/get-receipt.bru`
- Modify: `backend/bruno/README.md`

**Interfaces:** none — this task adds no application code, only manual-testing
requests, mirroring Phase 1's `backend/bruno/households/` structure and
conventions (`{{cookie}}` collection var set by `identity/sign-up`, `{{baseUrl}}`
from the `local` environment).

- [ ] **Step 1: Settings requests**

```
meta {
  name: Get AI settings
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/api/settings/ai
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}
```
Save as `backend/bruno/settings/get-ai-settings.bru`.

```
meta {
  name: Set active AI provider
  type: http
  seq: 2
}

patch {
  url: {{baseUrl}}/api/settings/ai
  body: json
  auth: none
}

headers {
  Cookie: {{cookie}}
}

body:json {
  {
    "provider": "gemini"
  }
}

docs {
  Owner only — 403 not_owner otherwise. 422 provider_not_configured if the
  chosen provider has no credentials in the backend's .env.
}
```
Save as `backend/bruno/settings/patch-ai-settings.bru`.

- [ ] **Step 2: Fridge requests**

```
meta {
  name: Create product
  type: http
  seq: 1
}

post {
  url: {{baseUrl}}/api/products
  body: json
  auth: none
}

headers {
  Cookie: {{cookie}}
}

body:json {
  {
    "name": "Lait",
    "quantity": { "amount": 1, "unit": "L" },
    "location": "fridge",
    "category": "Produits laitiers"
  }
}

script:post-response {
  const body = res.getBody();
  if (body && body.product && body.product.id) {
    bru.setVar("productId", body.product.id);
  }
}
```
Save as `backend/bruno/fridge/create-product.bru`.

```
meta {
  name: List products
  type: http
  seq: 2
}

get {
  url: {{baseUrl}}/api/products
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}
```
Save as `backend/bruno/fridge/list-products.bru`.

```
meta {
  name: Get product
  type: http
  seq: 3
}

get {
  url: {{baseUrl}}/api/products/{{productId}}
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}
```
Save as `backend/bruno/fridge/get-product.bru`.

```
meta {
  name: Update product
  type: http
  seq: 4
}

patch {
  url: {{baseUrl}}/api/products/{{productId}}
  body: json
  auth: none
}

headers {
  Cookie: {{cookie}}
}

body:json {
  {
    "name": "Lait entier"
  }
}
```
Save as `backend/bruno/fridge/update-product.bru`.

```
meta {
  name: Delete product
  type: http
  seq: 5
}

delete {
  url: {{baseUrl}}/api/products/{{productId}}
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}
```
Save as `backend/bruno/fridge/delete-product.bru`.

```
meta {
  name: Expiring soon
  type: http
  seq: 6
}

get {
  url: {{baseUrl}}/api/products/expiring-soon?days=3
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}
```
Save as `backend/bruno/fridge/expiring-soon.bru`.

```
meta {
  name: Lookup product by barcode
  type: http
  seq: 7
}

get {
  url: {{baseUrl}}/api/products/lookup?barcode=3017620422003
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}

docs {
  Real OpenFoodFacts call — result may be null if the barcode isn't in their
  catalog. Doesn't persist anything.
}
```
Save as `backend/bruno/fridge/lookup-product.bru`.

- [ ] **Step 3: Receipt requests**

```
meta {
  name: Scan receipt
  type: http
  seq: 1
}

post {
  url: {{baseUrl}}/api/receipts/scan
  body: multipartForm
  auth: none
}

headers {
  Cookie: {{cookie}}
}

body:multipart-form {
  image: @file()
}

docs {
  Select a receipt photo for the "image" field in Bruno's UI before sending.
  Needs a real AI_PROVIDER configured with real credentials in the backend's
  .env — unlike every other request in this collection, this one calls a
  real external AI provider.
}
```
Save as `backend/bruno/receipt/scan-receipt.bru`.

```
meta {
  name: Import receipt
  type: http
  seq: 2
}

post {
  url: {{baseUrl}}/api/receipts/import
  body: json
  auth: none
}

headers {
  Cookie: {{cookie}}
}

body:json {
  {
    "storeName": "Carrefour",
    "scannedAt": "2026-08-26T18:00:00Z",
    "totalAmount": 4.8,
    "items": [
      {
        "name": "Lait 1L",
        "quantity": 2,
        "unit": "piece",
        "category": "Produits laitiers",
        "price": 2.4,
        "location": "fridge"
      }
    ]
  }
}

script:post-response {
  const body = res.getBody();
  if (body && body.receipt && body.receipt.id) {
    bru.setVar("receiptId", body.receipt.id);
  }
}
```
Save as `backend/bruno/receipt/import-receipt.bru`.

```
meta {
  name: List receipts
  type: http
  seq: 3
}

get {
  url: {{baseUrl}}/api/receipts
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}
```
Save as `backend/bruno/receipt/list-receipts.bru`.

```
meta {
  name: Get receipt
  type: http
  seq: 4
}

get {
  url: {{baseUrl}}/api/receipts/{{receiptId}}
  body: none
  auth: none
}

headers {
  Cookie: {{cookie}}
}
```
Save as `backend/bruno/receipt/get-receipt.bru`.

- [ ] **Step 4: Update the Bruno README's flow section**

```md
<!-- backend/bruno/README.md — extend the "Flow" section (after step 8, sign out): -->

9. **households/Create household** (or **Join household**) is a prerequisite for
   every request below — `fridge`/`receipt` routes all sit behind
   `household_required_middleware` (403 `no_household` without one).
10. **settings/Get AI settings**, then **settings/Set active AI provider** (owner
    only) — switches which AI provider **receipt/Scan receipt** will actually call.
11. **fridge/Create product** captures `{{productId}}`, used by **Get/Update/Delete
    product** and **Expiring soon**.
12. **fridge/Lookup product by barcode** — real OpenFoodFacts call, no
    prerequisite.
13. **receipt/Scan receipt** needs a real AI provider configured (see step 10) —
    everything else in this collection works with zero external credentials.
14. **receipt/Import receipt** captures `{{receiptId}}`, used by **List/Get
    receipt**. Doesn't require having run Scan first — the import body is
    hand-editable, matching what the app would send after the user reviews/edits
    the scanned draft.

Covers Phase 2 (`fridge`, `receipt`, `settings`) on top of Phase 1
(`identity`, `household`). `recipe`/`shopping-list` remain a later phase.
```

- [ ] **Step 5: Validate the collection parses, boundary lint, full suite**

Run: `cd backend/bruno && npx --yes @usebruno/cli run --env local` (with the
backend running, `node ace serve`, in another terminal) — expect every request to
return a real HTTP status (2xx/4xx), not a parse error. `households/Join
household` will 409 without a second signed-up user, same caveat as Phase 1's
collection — not a bug.

Run: `cd backend && pnpm run boundaries`
Expected: `no dependency violations found` — no new rule added this phase, this
just confirms none of the 11 tasks introduced a forbidden import (the domain-owned
`ReceiptExtractionUnavailableError`/`ReceiptExtractionParseError` placement in
Task 8 exists specifically to keep this green).

Run: `cd backend && node ace test`
Expected: PASS — full suite (Phase 1 + Phase 2) green.

- [ ] **Step 6: Commit**

```bash
git add backend/bruno
git commit -m "test(backend): Bruno requests for settings/fridge/receipt endpoints"
```

---

## End-of-plan verification

- [ ] `cd backend && node ace test` — full suite green (unit + infrastructure +
  functional, Phase 1 and Phase 2 combined).
- [ ] `cd backend && pnpm run boundaries` — 0 violations.
- [ ] `cd backend && pnpm exec tsc --noEmit` — 0 errors.
- [ ] Manually exercise the flow once with the Bruno collection (Task 11, Step 5)
  against a running server with at least one real AI provider credential set, to
  confirm a real receipt photo scans and imports end-to-end — the automated tests
  never call a real AI provider, so this is the only check that actually verifies
  Gemini/OpenAI/Ollama JSON responses parse into a usable `ReceiptDraft` in
  practice.
- [ ] Reread ADR-0006 through ADR-0010 against the final code — confirm nothing
  drifted during implementation (same discipline as Phase 1's plan closed with).
