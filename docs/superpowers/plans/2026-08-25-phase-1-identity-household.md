# Phase 1 — Monorepo Scaffold + Identity/Household Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `fridge-ai` monorepo (pnpm workspace, Taskfile, Docker Compose,
CI) and ship a working, testable slice of the backend: boot, DB connectivity, and the
full `identity`/`household` bounded contexts (sign-up/sign-in via better-auth —
password + PocketID —, session, discoverable auth methods, and household
create/join/leave/delete/manage-members). No `fridge`/`receipt`/`shopping-list`/
`recipe`/`settings` (AI) modules yet — those are later phases, each producing their
own independently testable slice on top of this one.

**Architecture:** AdonisJS 7 + Lucid + Postgres backend in `src/{domain,application,
infrastructure,presentation}`, DDD strict, dependency-cruiser boundary lint enforced
from the first commit. Auth is better-auth (password + `genericOAuth` for PocketID),
wired statically from env (no hot-reload for auth — only the future AI-provider
setting hot-reloads, cf. ADR-0007). Everything outside `identity` will be scoped by
`householdId`, never `userId` — this phase builds the `Household` aggregate that
makes that possible.

**Tech Stack:** pnpm workspace, AdonisJS 7, `@adonisjs/lucid` 22 (Postgres), VineJS
validators, better-auth 1.6 (`genericOAuth` plugin), Kysely+pg (better-auth adapter),
Japa (unit + functional tests), `dependency-cruiser` + Taskfile + Docker Compose +
GitHub Actions CI (patterns reused verbatim from `~/dev/arr`).

**Spec:**
- `docs/phase-0/00-overview-et-points-a-valider.md`
- `docs/phase-0/01-arborescence.md`
- `docs/phase-0/02-modele-de-domaine.md`
- `docs/phase-0/03-schema-base-de-donnees.md`
- `docs/phase-0/04-endpoints-http.md`
- `docs/adr/0001` through `0010`

## Global Constraints

- Clean architecture / DDD strict: `src/domain` has zero dependencies on any other
  layer or any npm package (cf. `docs/adr/0002`). `src/application` never imports
  `infrastructure`/`presentation`. `src/infrastructure` never imports
  `presentation`. `src/presentation` never imports `infrastructure` directly — wiring
  happens in `providers/`, outside `src/`. Enforced by `dependency-cruiser`
  (Task 11), but every task must respect it from the start.
- Lucid models under `src/infrastructure/database/**/*.lucid.ts` only, never imported
  outside their own `*.repository.ts` (cf. `docs/adr/0002`, `docs/phase-0/01-arborescence.md`).
- Every table/entity outside `identity`'s own `user`/`session`/`account`/`verification`
  is scoped by `household_id` (cf. `docs/adr/0003`) — not applicable yet in this
  phase (only `household`/`household_member` exist), but no code in this phase should
  assume `userId`-scoping is how future modules will work.
- No plugin `admin` from better-auth, no `role`/`banned` columns (cf. `docs/adr/0004`).
- Error envelope: `{ error: { type, message, details? } }` (cf.
  `docs/phase-0/04-endpoints-http.md`, `presentation/shared/error-serializer.ts`).
- Node ≥ 24, pnpm 11.17.0, package manager pinned via `packageManager` field
  (reused from `~/dev/arr`, cf. `docs/adr/0001`/`0002`).
- French user-facing error messages (cf. established convention in
  `docs/phase-0/04-endpoints-http.md` examples).

---

## Task 1: Monorepo root scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.env.example`
- Create: `.dependency-cruiser.cjs`
- Create: `prettier.config.mjs`

**Interfaces:**
- Produces: the `backend` and `mobile` pnpm workspace members (backend created in
  Task 2; `mobile` is a later phase, but the workspace glob already includes it so no
  edit is needed when it's added).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "fridge-ai",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "engines": {
    "node": ">=24.0.0"
  },
  "packageManager": "pnpm@11.17.0",
  "devDependencies": {
    "dependency-cruiser": "^18.1.0",
    "prettier": "^3.8.3"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - backend
  - mobile
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
.env
!.env.example
build/
dist/
.adonisjs/
tmp/
*.log
.DS_Store
```

- [ ] **Step 4: Create `.editorconfig`**

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

- [ ] **Step 5: Create `.env.example`**

```bash
# Node
TZ=UTC
PORT=3333
HOST=localhost
NODE_ENV=development

# App
LOG_LEVEL=info
APP_KEY=
APP_URL=http://${HOST}:${PORT}

# better-auth session/cookie signing key (e.g. `openssl rand -base64 32`)
BETTER_AUTH_SECRET=

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=fridge_ai
DB_PASSWORD=fridge_ai
DB_DATABASE=fridge_ai

#--------------------------------------------------------------------
# CORS / better-auth trustedOrigins — the browser/app-facing origin(s).
#--------------------------------------------------------------------
CORS_ORIGIN=http://localhost:8081

#--------------------------------------------------------------------
# PocketID (OIDC) — optional. Leave unset to disable the "pocketid" auth
# method (cf. docs/adr/0005) — password login still works on its own.
#--------------------------------------------------------------------
# POCKETID_ISSUER_URL=https://auth.example.com
# POCKETID_CLIENT_ID=
# POCKETID_CLIENT_SECRET=

# Set to true to disable email/password sign-in entirely (PocketID-only instance).
DISABLE_PASSWORD_LOGIN=false
```

- [ ] **Step 6: Create `.dependency-cruiser.cjs`**

```js
/**
 * Shared boundary rules (cf. docs/adr/0002). Layer folders live under each
 * package's own `src/`, so every path pattern here is relative to that
 * package's `src/` — extended by backend/.dependency-cruiser.cjs (and later
 * mobile/.dependency-cruiser.cjs), which add their own `options.tsConfig`/`exclude`.
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-has-zero-dependencies',
      comment:
        'domain must not depend on any other layer, and must not depend on any npm package ' +
        '(cf. docs/phase-0/02-modele-de-domaine.md).',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { pathNot: '^src/domain' },
    },
    {
      name: 'application-only-depends-on-domain',
      comment: 'application must not depend on infrastructure or presentation.',
      severity: 'error',
      from: { path: '^src/application' },
      to: { path: '^src/(infrastructure|presentation)' },
    },
    {
      name: 'infrastructure-must-not-depend-on-presentation',
      comment: 'infrastructure may depend on domain and application, never on presentation.',
      severity: 'error',
      from: { path: '^src/infrastructure' },
      to: { path: '^src/presentation' },
    },
    {
      name: 'presentation-must-not-depend-on-infrastructure',
      comment:
        'presentation may depend on domain and application; wiring to infrastructure ' +
        'implementations happens in providers/, outside src/, never via a direct import.',
      severity: 'error',
      from: { path: '^src/presentation' },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'no-circular',
      comment: 'Circular imports make the layering hard to reason about.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
}
```

- [ ] **Step 7: Create `prettier.config.mjs`**

```js
export default {
  semi: false,
  singleQuote: true,
  printWidth: 100,
  trailingComma: 'all',
}
```

- [ ] **Step 8: Verify**

Run: `pnpm install`
Expected: succeeds (no `backend`/`mobile` packages exist yet, pnpm reports an empty
workspace — that's fine at this step).

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-workspace.yaml .gitignore .editorconfig .env.example .dependency-cruiser.cjs prettier.config.mjs
git commit -m "chore: monorepo root scaffold"
```

---

## Task 2: Backend AdonisJS skeleton boots

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/adonisrc.ts`
- Create: `backend/ace.js`
- Create: `backend/start/env.ts`
- Create: `backend/start/kernel.ts`
- Create: `backend/start/routes.ts`
- Create: `backend/start/validator.ts`
- Create: `backend/config/database.ts`
- Create: `backend/app/middleware/force_json_response_middleware.ts`
- Create: `backend/app/middleware/container_bindings_middleware.ts`
- Create: `backend/app/exceptions/handler.ts`
- Create: `backend/src/presentation/shared/exception-handler.ts`
- Create: `backend/src/presentation/health.routes.ts`
- Create: `backend/.env`
- Test: `backend/tests/functional/health.spec.ts`

**Interfaces:**
- Produces: `GET /health` → `200 { "status": "ok" }` (matches
  `docs/phase-0/04-endpoints-http.md`).

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "fridge-ai-backend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "scripts": {
    "start": "node bin/server.js",
    "build": "node ace build",
    "dev": "node ace serve --hmr",
    "test": "node ace test",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "boundaries": "depcruise --config .dependency-cruiser.cjs src"
  },
  "imports": {
    "#controllers/*": "./app/controllers/*.js",
    "#exceptions/*": "./app/exceptions/*.js",
    "#models/*": "./app/models/*.js",
    "#middleware/*": "./app/middleware/*.js",
    "#validators/*": "./app/validators/*.js",
    "#providers/*": "./providers/*.js",
    "#database/*": "./database/*.js",
    "#tests/*": "./tests/*.js",
    "#start/*": "./start/*.js",
    "#config/*": "./config/*.js",
    "#domain/*": "./src/domain/*.js",
    "#application/*": "./src/application/*.js",
    "#infrastructure/*": "./src/infrastructure/*.js",
    "#presentation/*": "./src/presentation/*.js"
  },
  "devDependencies": {
    "@adonisjs/assembler": "^8.4.0",
    "@adonisjs/eslint-config": "^3.1.0",
    "@adonisjs/tsconfig": "^2.0.0",
    "@japa/assert": "^4.2.0",
    "@japa/api-client": "^3.2.1",
    "@japa/plugin-adonisjs": "^5.2.0",
    "@japa/runner": "^5.3.0",
    "@poppinss/ts-exec": "^1.4.4",
    "@types/luxon": "^3.7.1",
    "@types/node": "~26.1.2",
    "@types/pg": "^8.20.0",
    "dependency-cruiser": "^18.1.0",
    "eslint": "^10.8.0",
    "hot-hook": "^1.0.0",
    "pino-pretty": "^13.1.3",
    "prettier": "^3.8.3",
    "typescript": "~6.0.3",
    "youch": "^4.1.1"
  },
  "dependencies": {
    "@adonisjs/core": "^7.3.3",
    "@adonisjs/cors": "^3.0.0",
    "@adonisjs/lucid": "^22.4.2",
    "@adonisjs/shield": "^9.0.0",
    "@vinejs/vine": "^4.4.0",
    "better-auth": "^1.6.25",
    "kysely": "^0.29.4",
    "luxon": "^3.7.2",
    "pg": "^8.22.0",
    "uuid": "^14.0.1"
  },
  "hotHook": {
    "boundaries": ["./app/controllers/**/*.ts", "./app/middleware/*.ts"]
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "extends": "@adonisjs/tsconfig/tsconfig.app.json",
  "compilerOptions": {
    "rootDir": "./",
    "outDir": "./build",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "#domain/*": ["./src/domain/*"],
      "#application/*": ["./src/application/*"],
      "#infrastructure/*": ["./src/infrastructure/*"],
      "#presentation/*": ["./src/presentation/*"]
    }
  }
}
```

- [ ] **Step 3: Create `backend/adonisrc.ts`**

```ts
import { indexEntities } from '@adonisjs/core'
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  experimental: {},

  commands: [() => import('@adonisjs/core/commands'), () => import('@adonisjs/lucid/commands')],

  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/shield/shield_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('#providers/shared_provider'),
    () => import('#providers/identity_provider'),
  ],

  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel'),
    () => import('#start/validator'),
  ],

  tests: {
    suites: [
      {
        files: [
          'tests/unit/**/*.spec.{ts,js}',
          'tests/domain/**/*.spec.{ts,js}',
          'tests/application/**/*.spec.{ts,js}',
          'tests/infrastructure/**/*.spec.{ts,js}',
        ],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/functional/**/*.spec.{ts,js}'],
        name: 'functional',
        timeout: 30000,
      },
    ],
    forceExit: false,
  },

  metaFiles: [],

  hooks: {
    init: [
      indexEntities({
        transformers: { enabled: true },
      }),
    ],
  },
})
```

- [ ] **Step 4: Create `backend/ace.js`**

```js
/// <reference path="./adonisrc.ts" />

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'

new Ignitor(new URL('./', import.meta.url))
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
  })
  .ace()
  .handle(process.argv.splice(2))
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
```

- [ ] **Step 5: Create `backend/start/env.ts`**

```ts
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // better-auth session/cookie signing key — cf. instance.ts.
  BETTER_AUTH_SECRET: Env.schema.secret(),

  // Database
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  // PocketID (OIDC) — cf. docs/adr/0005.
  POCKETID_ISSUER_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  POCKETID_CLIENT_ID: Env.schema.string.optional(),
  POCKETID_CLIENT_SECRET: Env.schema.string.optional(),
  DISABLE_PASSWORD_LOGIN: Env.schema.boolean.optional(),

  // Frontend/app origin(s) the client actually calls the API from — used by
  // better-auth's trustedOrigins check (cf. instance.ts), comma-separated.
  CORS_ORIGIN: Env.schema.string.optional(),
})
```

- [ ] **Step 6: Create `backend/start/kernel.ts`**

```ts
import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
  () => import('#middleware/force_json_response_middleware'),
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
])

router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
  () => import('#middleware/auth_middleware'),
])

export const middleware = router.named({
  householdRequired: () => import('#middleware/household_required_middleware'),
})
```

Note: `#middleware/auth_middleware` and `#middleware/household_required_middleware`
are created in Task 7 and Task 9 respectively — this file references them ahead of
time (matches the target `docs/phase-0/01-arborescence.md` layout), but the app will
not boot until Task 7 adds `auth_middleware.ts`. Task 2's own verification step
(below) only requires the route/health slice, added after Task 7 in practice — see
the note on step ordering at the end of this task.

- [ ] **Step 7: Create `backend/start/routes.ts`**

```ts
import '#presentation/health.routes'
```

- [ ] **Step 8: Create `backend/start/validator.ts`**

```ts
import vine, { symbols } from '@vinejs/vine'

vine.messagesProvider = (field) => {
  return `${field.name} is invalid`
}
```

- [ ] **Step 9: Create `backend/config/database.ts`**

```ts
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'pg',
  connections: {
    pg: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      debug: app.inDev,
    },
  },
})

export default dbConfig
```

- [ ] **Step 10: Create `backend/app/middleware/force_json_response_middleware.ts`**

```ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class ForceJsonResponseMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    ctx.request.request.headers.accept = 'application/json'
    return next()
  }
}
```

- [ ] **Step 11: Create `backend/app/middleware/container_bindings_middleware.ts`**

```ts
import { Logger } from '@adonisjs/core/logger'
import { HttpContext } from '@adonisjs/core/http'
import { type NextFn } from '@adonisjs/core/types/http'

export default class ContainerBindingsMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    ctx.containerResolver.bindValue(HttpContext, ctx)
    ctx.containerResolver.bindValue(Logger, ctx.logger)
    return next()
  }
}
```

- [ ] **Step 12: Create `backend/src/presentation/shared/exception-handler.ts`**

```ts
import app from '@adonisjs/core/services/app'
import { ExceptionHandler as BaseExceptionHandler } from '@adonisjs/core/http'

type RenderErrorAsJSON = BaseExceptionHandler['renderErrorAsJSON']
type RenderValidationErrorAsJSON = BaseExceptionHandler['renderValidationErrorAsJSON']

/**
 * Only reached for exceptions that escape a controller uncaught. Expected
 * domain/application errors never get here — controllers convert
 * `Result.err(...)` via `error-serializer.ts` and send a normal response
 * before returning. VineJS validation errors and AdonisJS's own
 * self-handling exceptions (route-not-found, etc.) are also handled by the
 * base class before this method runs.
 */
export class HttpExceptionHandler extends BaseExceptionHandler {
  protected debug = !app.inProduction

  async renderErrorAsJSON(...args: Parameters<RenderErrorAsJSON>): ReturnType<RenderErrorAsJSON> {
    const [error, ctx] = args
    if (this.isDebuggingEnabled(ctx)) return super.renderErrorAsJSON(error, ctx)

    // Most escaped exceptions carry a numeric `status` (Adonis convention).
    // better-auth's `APIError` (thrown by `auth.api.*` calls made directly
    // from application code, bypassing the HTTP bridge in auth.routes.ts)
    // is the exception: its `status` is a string status-code key (e.g.
    // "UNPROCESSABLE_ENTITY") and the numeric code lives in `statusCode`.
    const statusCode = (error as unknown as { statusCode?: unknown }).statusCode
    const status =
      typeof error.status === 'number'
        ? error.status
        : typeof statusCode === 'number'
          ? statusCode
          : 500

    ctx.response.status(status).send({
      error: { type: error.code ?? 'internal_error', message: error.message },
    })
  }

  async renderValidationErrorAsJSON(
    ...args: Parameters<RenderValidationErrorAsJSON>
  ): ReturnType<RenderValidationErrorAsJSON> {
    const [error, ctx] = args
    ctx.response.status(error.status).send({
      error: { type: 'validation_failed', message: 'Validation failed.', details: error.messages },
    })
  }
}
```

- [ ] **Step 13: Create `backend/app/exceptions/handler.ts`**

```ts
import { HttpExceptionHandler } from '#presentation/shared/exception-handler'

export default class extends HttpExceptionHandler {}
```

- [ ] **Step 14: Create `backend/src/presentation/health.routes.ts`**

```ts
import router from '@adonisjs/core/services/router'

router.get('/health', async ({ response }) => {
  return response.json({ status: 'ok' })
})
```

- [ ] **Step 15: Create `backend/.env`** (local dev only, gitignored)

```bash
TZ=UTC
PORT=3333
HOST=localhost
NODE_ENV=development
LOG_LEVEL=info
APP_KEY=dev-app-key-not-for-production-use
APP_URL=http://localhost:3333
BETTER_AUTH_SECRET=dev-better-auth-secret-not-for-production-use
DB_HOST=localhost
DB_PORT=5432
DB_USER=fridge_ai
DB_PASSWORD=fridge_ai
DB_DATABASE=fridge_ai
CORS_ORIGIN=http://localhost:8081
DISABLE_PASSWORD_LOGIN=false
```

- [ ] **Step 16: Install dependencies**

Run: `pnpm install`
Expected: succeeds, `backend/node_modules` populated.

**Step-ordering note:** `start/kernel.ts` (Step 6) references `#middleware/auth_middleware`
and `#middleware/household_required_middleware`, which don't exist until Task 7 and
Task 9. Create two temporary pass-through files now so the app boots for this task's
verification step; Task 7 replaces `auth_middleware.ts` with the real implementation,
Task 9 replaces `household_required_middleware.ts`.

- [ ] **Step 17: Create temporary `backend/app/middleware/auth_middleware.ts`**

```ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

// Temporary no-op — replaced by Task 7 with the real better-auth-backed resolver.
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    return next()
  }
}
```

- [ ] **Step 18: Create temporary `backend/app/middleware/household_required_middleware.ts`**

```ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

// Temporary no-op — replaced by Task 9 with the real household-membership guard.
export default class HouseholdRequiredMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    return next()
  }
}
```

- [ ] **Step 19: Write the functional test**

```ts
// backend/tests/functional/health.spec.ts
import { test } from '@japa/runner'

test.group('GET /health', () => {
  test('responds with 200 and status ok', async ({ client }) => {
    const response = await client.get('/health')
    response.assertStatus(200)
    response.assertBodyContains({ status: 'ok' })
  })
})
```

- [ ] **Step 20: Run test to verify it fails**

Run: `cd backend && node ace test functional`
Expected: FAIL (app doesn't boot yet without a DB connection reachable, or route
missing) — confirms the test harness runs before implementation is verified end-to-end.

- [ ] **Step 21: Start Postgres and run the test again**

This task doesn't need real business tables yet, but AdonisJS boots the Lucid
provider regardless — a reachable Postgres is required even for `/health`. Task 3
adds Docker Compose; for now, run `docker run --rm -d --name fridge-ai-db -e
POSTGRES_USER=fridge_ai -e POSTGRES_PASSWORD=fridge_ai -e POSTGRES_DB=fridge_ai -p
5432:5432 postgres:16-alpine` manually, then:

Run: `cd backend && node ace test functional`
Expected: PASS

- [ ] **Step 22: Commit**

```bash
git add backend/
git commit -m "chore(backend): AdonisJS skeleton boots, GET /health"
```

---

## Task 3: Docker Compose + Taskfile + Dockerfile + CI

**Files:**
- Create: `Taskfile.yml`
- Create: `compose.yml`
- Create: `compose.dev.yml`
- Create: `backend/Dockerfile`
- Create: `backend/docker-entrypoint.sh`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `Taskfile.yml`**

```yaml
version: '3'

vars:
  BACKEND: fridge-ai-backend

tasks:
  setup:
    desc: Install dependencies, copy .env files.
    cmds:
      - pnpm install
      - cmd: cp -n .env.example .env
        ignore_error: true
      - cmd: cp -n backend/.env.example backend/.env
        ignore_error: true

  dev:
    desc: Run the backend dev server locally (HMR), Postgres in Docker.
    deps: [dev:db]
    cmds:
      - task: dev:back

  dev:db:
    desc: Start only the Postgres container.
    cmds:
      - docker compose -f compose.yml up -d db

  dev:back:
    desc: Run the backend dev server locally (HMR).
    dir: backend
    cmds:
      - pnpm run dev

  db:migrate:
    desc: Run pending database migrations.
    dir: backend
    cmds:
      - node ace migration:run

  db:rollback:
    desc: Roll back the last migration batch.
    dir: backend
    cmds:
      - node ace migration:rollback

  db:reset:
    desc: Drop and re-migrate the database.
    dir: backend
    cmds:
      - node ace migration:fresh

  test:
    desc: Run backend tests (Japa).
    dir: backend
    cmds:
      - pnpm run test

  lint:
    desc: Lint the backend.
    cmds:
      - pnpm --filter {{.BACKEND}} run lint

  format:
    desc: Format the backend.
    cmds:
      - pnpm --filter {{.BACKEND}} run format

  typecheck:
    desc: Type-check the backend.
    cmds:
      - pnpm --filter {{.BACKEND}} run typecheck

  boundaries:
    desc: Enforce the domain/application/infrastructure/presentation dependency rule.
    cmds:
      - pnpm --filter {{.BACKEND}} run boundaries

  check:
    desc: The CI command — lint + typecheck + tests + boundary lint.
    cmds:
      - task: lint
      - task: typecheck
      - task: test
      - task: boundaries

  build:
    desc: Build the backend.
    cmds:
      - pnpm --filter {{.BACKEND}} run build

  up:
    desc: Start the production-like stack.
    cmds:
      - docker compose -f compose.yml up -d --build

  down:
    desc: Stop the stack.
    cmds:
      - docker compose -f compose.yml down

  logs:
    desc: Tail logs for the whole stack.
    cmds:
      - docker compose -f compose.yml logs -f
```

- [ ] **Step 2: Create `compose.yml`**

```yaml
networks:
  internal:

volumes:
  pgdata:

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-fridge_ai}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-fridge_ai}
      POSTGRES_DB: ${POSTGRES_DB:-fridge_ai}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-fridge_ai} -d ${POSTGRES_DB:-fridge_ai}']
      interval: 5s
      timeout: 5s
      retries: 10
    ports:
      - '${POSTGRES_PORT:-5432}:5432'
    networks:
      - internal

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: 3333
      LOG_LEVEL: ${LOG_LEVEL:-info}
      APP_KEY: ${APP_KEY}
      APP_URL: ${APP_URL:-http://localhost:3333}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: ${POSTGRES_USER:-fridge_ai}
      DB_PASSWORD: ${POSTGRES_PASSWORD:-fridge_ai}
      DB_DATABASE: ${POSTGRES_DB:-fridge_ai}
      CORS_ORIGIN: ${CORS_ORIGIN:-}
      POCKETID_ISSUER_URL: ${POCKETID_ISSUER_URL:-}
      POCKETID_CLIENT_ID: ${POCKETID_CLIENT_ID:-}
      POCKETID_CLIENT_SECRET: ${POCKETID_CLIENT_SECRET:-}
      DISABLE_PASSWORD_LOGIN: ${DISABLE_PASSWORD_LOGIN:-false}
    depends_on:
      db:
        condition: service_healthy
    ports:
      - '${BACKEND_PORT:-3333}:3333'
    networks:
      - internal
```

- [ ] **Step 3: Create `compose.dev.yml`**

```yaml
# Overlay for local dev: only the DB runs in Docker (cf. `task dev`), backend
# runs on the host with HMR.
services:
  db:
    ports:
      - '5432:5432'
```

- [ ] **Step 4: Create `backend/Dockerfile`**

```dockerfile
# Built with the monorepo root as build context (needs pnpm-workspace.yaml
# and the lockfile) — see compose.yml: build.context: . / dockerfile: backend/Dockerfile

FROM node:26-alpine AS base
RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY backend/package.json ./backend/package.json
RUN pnpm install --frozen-lockfile --filter fridge-ai-backend...

FROM deps AS build
COPY backend ./backend
RUN pnpm --filter fridge-ai-backend run build

FROM base AS production
ENV NODE_ENV=production
RUN addgroup -S fridgeai && adduser -S fridgeai -G fridgeai
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/build ./backend/build
COPY --from=build /app/backend/package.json ./backend/package.json
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && chown -R fridgeai:fridgeai /app
USER fridgeai
WORKDIR /app/backend/build
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3333/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "bin/server.js"]
```

- [ ] **Step 5: Create `backend/docker-entrypoint.sh`**

```sh
#!/bin/sh
set -e

if [ "$1" = "node" ] && [ "$2" = "bin/server.js" ]; then
  echo "Running database migrations..."
  node bin/console.js migration:run --force
fi

exec "$@"
```

- [ ] **Step 6: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  check:
    name: Lint, typecheck, tests, boundaries
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: fridge_ai
          POSTGRES_PASSWORD: fridge_ai
          POSTGRES_DB: fridge_ai_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U fridge_ai -d fridge_ai_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      NODE_ENV: test
      TZ: UTC
      PORT: 3333
      HOST: localhost
      LOG_LEVEL: info
      APP_KEY: ci-test-app-key-not-for-production-use
      BETTER_AUTH_SECRET: ci-test-better-auth-secret-not-for-production-use
      APP_URL: http://localhost:3333
      DB_HOST: localhost
      DB_PORT: 5432
      DB_USER: fridge_ai
      DB_PASSWORD: fridge_ai
      DB_DATABASE: fridge_ai_test

    steps:
      - uses: actions/checkout@v7

      - name: Enable corepack
        run: corepack enable

      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: pnpm

      - uses: arduino/setup-task@c0bc642852239c2689f73f4ea6459c29405f3c52 # v3.0.0
        with:
          version: 3.x
          repo-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run checks (lint + typecheck + tests + boundary lint)
        run: task check

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - name: Enable corepack
        run: corepack enable

      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: pnpm

      - uses: arduino/setup-task@c0bc642852239c2689f73f4ea6459c29405f3c52 # v3.0.0
        with:
          version: 3.x
          repo-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build the backend
        run: task build
```

- [ ] **Step 7: Verify**

Run: `task dev:db` then `task db:migrate` (no migrations exist yet — should report
"no pending migrations" without erroring), then `task test`.
Expected: `dev:db` starts a healthy Postgres container; `test` passes (Task 2's
health test, against the Dockerized DB now instead of the manual `docker run`).

- [ ] **Step 8: Commit**

```bash
git add Taskfile.yml compose.yml compose.dev.yml backend/Dockerfile backend/docker-entrypoint.sh .github/workflows/ci.yml
git commit -m "chore: Taskfile, Docker Compose, Dockerfile, CI"
```

---

## Task 4: Shared domain kernel

**Files:**
- Create: `backend/src/domain/shared/entity.ts`
- Create: `backend/src/domain/shared/aggregate-root.ts`
- Create: `backend/src/domain/shared/value-object.ts`
- Create: `backend/src/domain/shared/domain-event.ts`
- Create: `backend/src/domain/shared/result.ts`
- Create: `backend/src/domain/shared/validation-error.ts`
- Create: `backend/src/domain/shared/clock.interface.ts`
- Create: `backend/src/domain/shared/id-generator.interface.ts`
- Create: `backend/src/infrastructure/shared/system-clock.ts`
- Create: `backend/src/infrastructure/shared/uuid-id-generator.ts`
- Create: `backend/src/application/shared/use-case.ts`
- Create: `backend/providers/shared_provider.ts`
- Test: `backend/tests/unit/domain/shared/entity.spec.ts`
- Test: `backend/tests/unit/domain/shared/value-object.spec.ts`
- Test: `backend/tests/unit/domain/shared/result.spec.ts`

**Interfaces:**
- Produces: `Entity<Id>`, `AggregateRoot<Id>`, `ValueObject<Props>`, `DomainEvent`,
  `Result<T, E>` / `Result.ok`/`Result.err`, `ValidationError { field, message }`,
  `Clock.now(): Date`, `IdGenerator.next(): string`, `UseCase<Input, Output>`. Bound
  in the container as `shared.clock` (`Clock`) and `shared.idGenerator`
  (`IdGenerator`) — every later use-case that needs the current time or a fresh id
  consumes these, never `new Date()`/`crypto.randomUUID()` directly.

- [ ] **Step 1: Write the failing tests**

```ts
// backend/tests/unit/domain/shared/entity.spec.ts
import { test } from '@japa/runner'
import { Entity } from '#domain/shared/entity'

class TestEntity extends Entity<string> {
  static create(id: string): TestEntity {
    return new TestEntity(id)
  }
}

test.group('Entity', () => {
  test('two entities with the same id and class are equal', ({ assert }) => {
    assert.isTrue(TestEntity.create('a').equals(TestEntity.create('a')))
  })

  test('two entities with different ids are not equal', ({ assert }) => {
    assert.isFalse(TestEntity.create('a').equals(TestEntity.create('b')))
  })

  test('an entity does not equal a non-entity', ({ assert }) => {
    assert.isFalse(TestEntity.create('a').equals({ id: 'a' }))
  })
})
```

```ts
// backend/tests/unit/domain/shared/value-object.spec.ts
import { test } from '@japa/runner'
import { ValueObject } from '#domain/shared/value-object'

class TestVo extends ValueObject<{ value: string }> {
  static create(value: string): TestVo {
    return new TestVo({ value })
  }
  get value(): string {
    return this.props.value
  }
}

test.group('ValueObject', () => {
  test('two value objects with equal props are equal', ({ assert }) => {
    assert.isTrue(TestVo.create('a').equals(TestVo.create('a')))
  })

  test('two value objects with different props are not equal', ({ assert }) => {
    assert.isFalse(TestVo.create('a').equals(TestVo.create('b')))
  })
})
```

```ts
// backend/tests/unit/domain/shared/result.spec.ts
import { test } from '@japa/runner'
import { Result } from '#domain/shared/result'

test.group('Result', () => {
  test('ok() produces an ok result carrying the value', ({ assert }) => {
    const result = Result.ok(42)
    assert.isTrue(result.ok)
    assert.equal(result.value, 42)
  })

  test('err() produces an err result carrying the error', ({ assert }) => {
    const result = Result.err('boom')
    assert.isFalse(result.ok)
    assert.equal(result.error, 'boom')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && node ace test unit`
Expected: FAIL with "Cannot find module '#domain/shared/entity'" (and siblings).

- [ ] **Step 3: Implement the shared kernel**

```ts
// backend/src/domain/shared/entity.ts
export abstract class Entity<Id> {
  readonly id: Id

  protected constructor(id: Id) {
    this.id = id
  }

  equals(other: unknown): boolean {
    if (other === this) return true
    if (!(other instanceof Entity)) return false
    if (other.constructor !== this.constructor) return false
    return other.id === this.id
  }
}
```

```ts
// backend/src/domain/shared/domain-event.ts
export interface DomainEvent<Payload = unknown> {
  readonly name: string
  readonly occurredAt: Date
  readonly payload: Payload
}
```

```ts
// backend/src/domain/shared/aggregate-root.ts
import { Entity } from './entity.js'
import type { DomainEvent } from './domain-event.js'

export abstract class AggregateRoot<Id> extends Entity<Id> {
  private events: DomainEvent[] = []

  protected record(event: DomainEvent): void {
    this.events.push(event)
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this.events
    this.events = []
    return events
  }
}
```

```ts
// backend/src/domain/shared/value-object.ts
/**
 * Concrete value objects keep their constructor private and expose a static
 * `create(...)` factory returning either the VO directly (when creation
 * cannot fail) or a `Result<TheVO, ValidationError>` (when it can) — this
 * base class only provides structural equality and immutability.
 */
export abstract class ValueObject<Props> {
  protected readonly props: Props

  protected constructor(props: Props) {
    this.props = Object.freeze(props)
  }

  equals(other: unknown): boolean {
    if (other === this) return true
    if (!(other instanceof ValueObject)) return false
    if (other.constructor !== this.constructor) return false
    return JSON.stringify(other.props) === JSON.stringify(this.props)
  }
}
```

```ts
// backend/src/domain/shared/result.ts
export interface Ok<T> {
  readonly ok: true
  readonly value: T
}

export interface Err<E> {
  readonly ok: false
  readonly error: E
}

export type Result<T, E> = Ok<T> | Err<E>

export const Result = {
  ok<T>(value: T): Ok<T> {
    return { ok: true, value }
  },
  err<E>(error: E): Err<E> {
    return { ok: false, error }
  },
}
```

```ts
// backend/src/domain/shared/validation-error.ts
export interface ValidationError {
  readonly field: string
  readonly message: string
}
```

```ts
// backend/src/domain/shared/clock.interface.ts
export interface Clock {
  now(): Date
}
```

```ts
// backend/src/domain/shared/id-generator.interface.ts
export interface IdGenerator {
  next(): string
}
```

```ts
// backend/src/infrastructure/shared/system-clock.ts
import type { Clock } from '#domain/shared/clock.interface'

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}
```

```ts
// backend/src/infrastructure/shared/uuid-id-generator.ts
import { v7 as uuidv7 } from 'uuid'
import type { IdGenerator } from '#domain/shared/id-generator.interface'

export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return uuidv7()
  }
}
```

```ts
// backend/src/application/shared/use-case.ts
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>
}
```

```ts
// backend/providers/shared_provider.ts
import type { ApplicationService } from '@adonisjs/core/types'
import type { Clock } from '#domain/shared/clock.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'

/**
 * `Clock`/`IdGenerator` are stateless, dependency-free — this binding exists
 * only so presentation controllers can get to them without importing
 * `src/infrastructure/*` directly, which the dependency-cruiser boundary
 * rules forbid (providers/ sits outside src/, so it's the sanctioned place
 * to wire infrastructure to a port).
 */
export default class SharedProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('shared.clock', async () => {
      const { SystemClock } = await import('#infrastructure/shared/system-clock')
      return new SystemClock()
    })

    this.app.container.singleton('shared.idGenerator', async () => {
      const { UuidIdGenerator } = await import('#infrastructure/shared/uuid-id-generator')
      return new UuidIdGenerator()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'shared.clock': Clock
    'shared.idGenerator': IdGenerator
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && node ace test unit`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/shared backend/src/infrastructure/shared backend/src/application/shared backend/providers/shared_provider.ts backend/tests/unit/domain/shared
git commit -m "feat(shared): domain kernel (Entity, AggregateRoot, ValueObject, Result) + Clock/IdGenerator"
```

---

## Task 5: Identity + household + ai_provider_setting migrations

**Files:**
- Create: `backend/database/migrations/1785200000001_create_identity_tables_table.ts`
- Create: `backend/database/migrations/1785200000002_create_household_tables_table.ts`
- Create: `backend/database/migrations/1785200000003_create_ai_provider_setting_table.ts`

**Interfaces:**
- Produces: tables `user`, `session`, `account`, `verification`, `household`,
  `household_member`, `ai_provider_setting` (cf.
  `docs/phase-0/03-schema-base-de-donnees.md`). `ai_provider_setting` is created now
  (cheap, migration-only) even though the `settings` module itself is a later phase —
  keeps migration numbering append-only and lets a future phase add the module
  without a schema migration blocking it; no code in this phase reads/writes it.

- [ ] **Step 1: Create the identity migration**

```ts
// backend/database/migrations/1785200000001_create_identity_tables_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Hand-written to match better-auth's core schema (email/password +
 * genericOAuth), WITHOUT the `admin` plugin (cf. docs/adr/0004) — no
 * `role`/`banned`/`ban_reason`/`ban_expires` on `user`, no
 * `impersonated_by` on `session`. Re-verify against
 * `npx @better-auth/cli generate` once the library is configured (Task 7).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('user', (table) => {
      table.text('id').primary()
      table.text('name').notNullable()
      table.text('email').notNullable().unique()
      table.boolean('email_verified').notNullable().defaultTo(false)
      table.text('image').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('session', (table) => {
      table.text('id').primary()
      table.text('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('token').notNullable().unique()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.text('ip_address').nullable()
      table.text('user_agent').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('account', (table) => {
      table.text('id').primary()
      table.text('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('account_id').notNullable()
      table.text('provider_id').notNullable()
      table.text('access_token').nullable()
      table.text('refresh_token').nullable()
      table.timestamp('access_token_expires_at', { useTz: true }).nullable()
      table.timestamp('refresh_token_expires_at', { useTz: true }).nullable()
      table.text('scope').nullable()
      table.text('id_token').nullable()
      table.text('password').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('verification', (table) => {
      table.text('id').primary()
      table.text('identifier').notNullable()
      table.text('value').notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable('verification')
    this.schema.dropTable('account')
    this.schema.dropTable('session')
    this.schema.dropTable('user')
  }
}
```

- [ ] **Step 2: Create the household migration**

```ts
// backend/database/migrations/1785200000002_create_household_tables_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('household', (table) => {
      table.text('id').primary()
      table.text('name').notNullable()
      table.text('owner_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('invite_code').notNullable().unique()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.createTable('household_member', (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('role').notNullable().checkIn(['owner', 'member'])
      table.timestamp('joined_at', { useTz: true }).notNullable().defaultTo(this.now())
      // Invariant "un seul foyer par utilisateur" (docs/adr/0003) — applied
      // in the database, not just the aggregate.
      table.unique(['user_id'])
    })

    this.schema.alterTable('household_member', (table) => {
      table.index('household_id')
    })
  }

  async down() {
    this.schema.dropTable('household_member')
    this.schema.dropTable('household')
  }
}
```

- [ ] **Step 3: Create the `ai_provider_setting` migration**

```ts
// backend/database/migrations/1785200000003_create_ai_provider_setting_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Cf. docs/adr/0007. Not used by any code until the `settings` module lands
 * in a later phase — created now so migration numbering stays append-only.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('ai_provider_setting', (table) => {
      table.text('id').primary()
      table.text('active_provider').notNullable().checkIn(['gemini', 'openai', 'ollama'])
      table.text('updated_by').nullable().references('id').inTable('user').onDelete('SET NULL')
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable('ai_provider_setting')
  }
}
```

- [ ] **Step 4: Run migrations**

Run: `task dev:db` (if not already running), then `cd backend && node ace migration:run`
Expected: 3 migrations applied, no errors.

- [ ] **Step 5: Verify rollback works cleanly**

Run: `cd backend && node ace migration:rollback --batch=0 && node ace migration:run`
Expected: all tables dropped then recreated without error (proves `down()` is correct).

- [ ] **Step 6: Commit**

```bash
git add backend/database/migrations
git commit -m "feat(db): identity, household, ai_provider_setting migrations"
```

---

## Task 6: Identity domain

**Files:**
- Create: `backend/src/domain/identity/email.vo.ts`
- Create: `backend/src/domain/identity/user.entity.ts`
- Create: `backend/src/domain/identity/authenticated-user.vo.ts`
- Create: `backend/src/domain/identity/auth-method.vo.ts`
- Create: `backend/src/domain/identity/interfaces/user-directory.interface.ts`
- Create: `backend/src/domain/identity/interfaces/authentication.interface.ts`
- Create: `backend/src/domain/identity/interfaces/session.interface.ts`
- Create: `backend/src/domain/identity/interfaces/auth-methods-provider.interface.ts`
- Test: `backend/tests/unit/domain/identity/email.vo.spec.ts`

**Interfaces:**
- Consumes: `ValueObject`, `Entity`, `Result`, `ValidationError` (Task 4).
- Produces: `Email.create(raw: string): Result<Email, ValidationError>`, `Email.value:
  string`. `User.create(id, { email, name, image, createdAt }): User`. `AuthenticatedUser.
  create({ id, email, name }): AuthenticatedUser`. `AuthMethod.create({ id: 'password' |
  'pocketid', enabled, label }): AuthMethod`. Interfaces `UserDirectory`,
  `Authentication`, `Session`, `AuthMethodsProvider` — implemented in Task 7.

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/unit/domain/identity/email.vo.spec.ts
import { test } from '@japa/runner'
import { Email } from '#domain/identity/email.vo'

test.group('Email', () => {
  test('accepts a well-formed address, normalized to lowercase', ({ assert }) => {
    const result = Email.create('  Alice@Example.com  ')
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value.value, 'alice@example.com')
  })

  test('rejects a string without an @', ({ assert }) => {
    const result = Email.create('not-an-email')
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error.field, 'email')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node ace test unit`
Expected: FAIL with "Cannot find module '#domain/identity/email.vo'"

- [ ] **Step 3: Implement the identity domain**

```ts
// backend/src/domain/identity/email.vo.ts
import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface EmailProps {
  value: string
}

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props)
  }

  static create(raw: string): Result<Email, ValidationError> {
    const normalized = raw.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(normalized)) {
      return Result.err({ field: 'email', message: `"${raw}" n'est pas une adresse email valide` })
    }
    return Result.ok(new Email({ value: normalized }))
  }

  get value(): string {
    return this.props.value
  }

  toString(): string {
    return this.props.value
  }
}
```

```ts
// backend/src/domain/identity/user.entity.ts
import { Entity } from '#domain/shared/entity'
import type { Email } from './email.vo.js'

interface UserProps {
  email: Email
  name: string
  image: string | null
  createdAt: Date
}

/**
 * Read model reconstructed from better-auth's `user` table — never written
 * to directly by this domain (account creation/edits go through
 * better-auth's own API, cf. docs/adr/0004/0005).
 */
export class User extends Entity<string> {
  private props: UserProps

  private constructor(id: string, props: UserProps) {
    super(id)
    this.props = props
  }

  static create(id: string, props: UserProps): User {
    return new User(id, props)
  }

  get email(): Email {
    return this.props.email
  }

  get name(): string {
    return this.props.name
  }

  get image(): string | null {
    return this.props.image
  }

  get createdAt(): Date {
    return this.props.createdAt
  }
}
```

```ts
// backend/src/domain/identity/authenticated-user.vo.ts
import { ValueObject } from '#domain/shared/value-object'
import type { Email } from './email.vo.js'

interface AuthenticatedUserProps {
  id: string
  email: Email
  name: string
}

export class AuthenticatedUser extends ValueObject<AuthenticatedUserProps> {
  private constructor(props: AuthenticatedUserProps) {
    super(props)
  }

  static create(props: AuthenticatedUserProps): AuthenticatedUser {
    return new AuthenticatedUser(props)
  }

  get id(): string {
    return this.props.id
  }

  get email(): Email {
    return this.props.email
  }

  get name(): string {
    return this.props.name
  }
}
```

```ts
// backend/src/domain/identity/auth-method.vo.ts
import { ValueObject } from '#domain/shared/value-object'

export type AuthMethodId = 'password' | 'pocketid'

interface AuthMethodProps {
  id: AuthMethodId
  enabled: boolean
  label: string
}

export class AuthMethod extends ValueObject<AuthMethodProps> {
  private constructor(props: AuthMethodProps) {
    super(props)
  }

  static create(props: AuthMethodProps): AuthMethod {
    return new AuthMethod(props)
  }

  get id(): AuthMethodId {
    return this.props.id
  }

  get enabled(): boolean {
    return this.props.enabled
  }

  get label(): string {
    return this.props.label
  }
}
```

```ts
// backend/src/domain/identity/interfaces/user-directory.interface.ts
import type { Email } from '../email.vo.js'
import type { User } from '../user.entity.js'

export interface UserDirectory {
  findById(id: string): Promise<User | null>
  findByIds(ids: string[]): Promise<User[]>
  findByEmail(email: Email): Promise<User | null>
}
```

```ts
// backend/src/domain/identity/interfaces/authentication.interface.ts
import type { Email } from '../email.vo.js'
import type { AuthenticatedUser } from '../authenticated-user.vo.js'
import type { Result } from '#domain/shared/result'

export type AuthenticationError = 'invalid_credentials'

export interface PasswordCredentials {
  email: Email
  password: string
}

export interface Authentication {
  signInWithPassword(
    credentials: PasswordCredentials,
  ): Promise<Result<AuthenticatedUser, AuthenticationError>>
  signOut(sessionToken: string): Promise<void>
}
```

```ts
// backend/src/domain/identity/interfaces/session.interface.ts
import type { AuthenticatedUser } from '../authenticated-user.vo.js'

export interface Session {
  resolve(sessionToken: string): Promise<AuthenticatedUser | null>
}
```

```ts
// backend/src/domain/identity/interfaces/auth-methods-provider.interface.ts
import type { AuthMethod } from '../auth-method.vo.js'

export interface AuthMethodsProvider {
  resolve(): Promise<AuthMethod[]>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node ace test unit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/identity backend/tests/unit/domain/identity
git commit -m "feat(identity): domain (Email, User, AuthenticatedUser, AuthMethod, ports)"
```

---

## Task 7: better-auth wiring + auth bridge + session + auth-methods

**Files:**
- Create: `backend/src/infrastructure/auth/better-auth/instance.ts`
- Create: `backend/src/infrastructure/auth/better-auth/authentication.adapter.ts`
- Create: `backend/src/infrastructure/auth/better-auth/session.adapter.ts`
- Create: `backend/src/infrastructure/auth/auth-methods.provider.ts`
- Create: `backend/src/infrastructure/database/identity/user-directory.repository.ts`
- Create: `backend/src/application/identity/get-current-user.use-case.ts`
- Create: `backend/src/application/identity/sign-out.use-case.ts`
- Create: `backend/src/application/identity/get-auth-methods.use-case.ts`
- Create: `backend/src/presentation/shared/auth-context.ts`
- Create: `backend/src/presentation/shared/error-serializer.ts`
- Create: `backend/src/presentation/identity/auth.routes.ts`
- Create: `backend/src/presentation/identity/session.controller.ts`
- Create: `backend/src/presentation/identity/auth-methods.controller.ts`
- Create: `backend/providers/identity_provider.ts`
- Modify: `backend/app/middleware/auth_middleware.ts` (replace the Task 2 no-op)
- Modify: `backend/start/routes.ts` (add the identity routes import)
- Modify: `backend/adonisrc.ts` (already imports `#providers/identity_provider` from
  Task 2 — no change needed)
- Test: `backend/tests/functional/identity/auth.spec.ts`

**Interfaces:**
- Consumes: `Email`, `AuthenticatedUser`, `AuthMethod`, `UserDirectory`,
  `Authentication`, `Session`, `AuthMethodsProvider` (Task 6).
- Produces: `GET /api/session`, `GET /api/auth/methods`, `ANY /api/auth/*` (bridged
  to better-auth: `/api/auth/sign-up/email`, `/api/auth/sign-in/email`,
  `/api/auth/sign-in/social?provider=pocketid`, `/api/auth/sign-out`, etc.).
  `ctx.authenticatedUser: AuthenticatedUser | null` set on every request.
  Container bindings `identity.userDirectory`, `identity.authentication`,
  `identity.session`, `identity.authMethodsProvider`, `identity.authHandler` —
  consumed by Task 9/10's household controller and by `household_required_middleware`
  (Task 9); `identity.authHandler` is consumed only by `auth.routes.ts` in this
  same task (keeps the `/api/auth/*` bridge off a direct `src/infrastructure` import,
  cf. `docs/adr/0002`).

- [ ] **Step 1: Create the better-auth instance**

```ts
// backend/src/infrastructure/auth/better-auth/instance.ts
import { betterAuth } from 'better-auth'
import { genericOAuth } from 'better-auth/plugins'
import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import env from '#start/env'

const pool = new Pool({
  host: env.get('DB_HOST'),
  port: env.get('DB_PORT'),
  user: env.get('DB_USER'),
  password: env.get('DB_PASSWORD'),
  database: env.get('DB_DATABASE'),
})

const db = new Kysely({ dialect: new PostgresDialect({ pool }) })

const pocketIdClientId = env.get('POCKETID_CLIENT_ID', '')
const pocketIdClientSecret = env.get('POCKETID_CLIENT_SECRET', '')
const pocketIdIssuerUrl = env.get('POCKETID_ISSUER_URL', '')
const pocketIdConfigured = Boolean(pocketIdClientId && pocketIdClientSecret && pocketIdIssuerUrl)

/**
 * Unlike arr's OIDC config (hot-reloaded from a settings table), PocketID
 * here is static from env for the whole process lifetime — only the AI
 * provider hot-reloads (cf. docs/adr/0005, docs/adr/0007). One instance,
 * built once at module load.
 */
export const auth = betterAuth({
  database: { db, type: 'postgres' },
  secret: env.get('BETTER_AUTH_SECRET').release(),
  baseURL: env.get('APP_URL'),
  trustedOrigins: env
    .get('CORS_ORIGIN', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  emailAndPassword: { enabled: !env.get('DISABLE_PASSWORD_LOGIN', false) },
  /**
   * The migration (`create_identity_tables_table.ts`) uses snake_case
   * columns, matching every other table in this codebase — better-auth's
   * Kysely adapter otherwise queries columns by its own camelCase field
   * names verbatim (no automatic case translation), so every multi-word
   * field needs an explicit mapping here.
   */
  user: {
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  session: {
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  account: {
    fields: {
      userId: 'user_id',
      accountId: 'account_id',
      providerId: 'provider_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    /**
     * Copied verbatim from arr's câblage (cf. docs/phase-0/00-overview,
     * point "PocketID/better-auth d'arr, complète et fonctionnelle").
     * better-auth resolves an incoming OIDC identity to an existing user by
     * email automatically — what's gated by default is whether to link
     * *implicitly* without an extra verification step. Both default guards
     * would block it here: 'pocketid' isn't in trustedProviders by default,
     * and requireLocalEmailVerified defaults to true while this app has no
     * email-verification flow at all.
     */
    accountLinking: {
      enabled: true,
      trustedProviders: ['pocketid'],
      requireLocalEmailVerified: false,
    },
  },
  verification: {
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  plugins: pocketIdConfigured
    ? [
        genericOAuth({
          config: [
            {
              providerId: 'pocketid',
              clientId: pocketIdClientId,
              clientSecret: pocketIdClientSecret,
              discoveryUrl: `${pocketIdIssuerUrl}/.well-known/openid-configuration`,
              // Without this, better-auth defaults to `scopes: []` — an
              // empty `scope=` param that PocketID rejects outright with
              // access_denied rather than a scope-specific error.
              scopes: ['openid', 'profile', 'email'],
            },
          ],
        }),
      ]
    : [],
})

export type Auth = typeof auth
```

- [ ] **Step 2: Create the authentication and session adapters**

```ts
// backend/src/infrastructure/auth/better-auth/authentication.adapter.ts
import { APIError } from 'better-auth'
import { auth } from './instance.js'
import type {
  Authentication,
  AuthenticationError,
  PasswordCredentials,
} from '#domain/identity/interfaces/authentication.interface'
import type { AuthenticatedUser as AuthenticatedUserType } from '#domain/identity/authenticated-user.vo'
import { AuthenticatedUser } from '#domain/identity/authenticated-user.vo'
import type { Result } from '#domain/shared/result'
import { Result as ResultNS } from '#domain/shared/result'

/**
 * The real browser login flow goes through better-auth's own mounted
 * handler at /api/auth/sign-in/email (it sets the response cookie itself —
 * this port's return type has no room for that). This adapter exists for
 * architectural symmetry and any non-browser caller.
 */
export class BetterAuthAuthentication implements Authentication {
  async signInWithPassword(
    credentials: PasswordCredentials,
  ): Promise<Result<AuthenticatedUserType, AuthenticationError>> {
    try {
      const result = await auth.api.signInEmail({
        body: { email: credentials.email.value, password: credentials.password },
      })
      return ResultNS.ok(
        AuthenticatedUser.create({
          id: result.user.id,
          email: credentials.email,
          name: result.user.name,
        }),
      )
    } catch (error) {
      if (error instanceof APIError) return ResultNS.err('invalid_credentials')
      throw error
    }
  }

  async signOut(sessionToken: string): Promise<void> {
    await auth.api.signOut({ headers: new Headers({ cookie: sessionToken }) })
  }
}
```

```ts
// backend/src/infrastructure/auth/better-auth/session.adapter.ts
import { auth } from './instance.js'
import type { Session } from '#domain/identity/interfaces/session.interface'
import type { AuthenticatedUser as AuthenticatedUserType } from '#domain/identity/authenticated-user.vo'
import { AuthenticatedUser } from '#domain/identity/authenticated-user.vo'
import { Email } from '#domain/identity/email.vo'

/**
 * `sessionToken` here is the raw `Cookie` request header, not a bare token —
 * better-auth resolves sessions from its own (possibly chunked) cookie jar,
 * so re-deriving its cookie name/format in this adapter would be fragile.
 */
export class BetterAuthSession implements Session {
  async resolve(sessionToken: string): Promise<AuthenticatedUserType | null> {
    const result = await auth.api.getSession({ headers: new Headers({ cookie: sessionToken }) })
    if (!result) return null

    const email = Email.create(result.user.email)
    if (!email.ok) return null

    return AuthenticatedUser.create({
      id: result.user.id,
      email: email.value,
      name: result.user.name,
    })
  }
}
```

- [ ] **Step 3: Create the auth methods provider**

```ts
// backend/src/infrastructure/auth/auth-methods.provider.ts
import env from '#start/env'
import { AuthMethod } from '#domain/identity/auth-method.vo'
import type { AuthMethodsProvider } from '#domain/identity/interfaces/auth-methods-provider.interface'

export class EnvAuthMethodsProvider implements AuthMethodsProvider {
  async resolve(): Promise<AuthMethod[]> {
    const methods: AuthMethod[] = []

    if (!env.get('DISABLE_PASSWORD_LOGIN', false)) {
      methods.push(AuthMethod.create({ id: 'password', enabled: true, label: 'Email et mot de passe' }))
    }

    const pocketIdConfigured =
      Boolean(env.get('POCKETID_CLIENT_ID', '')) &&
      Boolean(env.get('POCKETID_CLIENT_SECRET', '')) &&
      Boolean(env.get('POCKETID_ISSUER_URL', ''))

    if (pocketIdConfigured) {
      methods.push(AuthMethod.create({ id: 'pocketid', enabled: true, label: 'PocketID' }))
    }

    return methods
  }
}
```

- [ ] **Step 4: Create the user directory repository**

```ts
// backend/src/infrastructure/database/identity/user-directory.repository.ts
import db from '@adonisjs/lucid/services/db'
import type { UserDirectory } from '#domain/identity/interfaces/user-directory.interface'
import { Email } from '#domain/identity/email.vo'
import { User } from '#domain/identity/user.entity'

interface UserRow {
  id: string
  email: string
  name: string
  image: string | null
  created_at: Date | string
}

function toDomain(row: UserRow): User {
  const email = Email.create(row.email)
  if (!email.ok) throw new Error(`Corrupted user row ${row.id}: ${email.error.message}`)

  const createdAt = row.created_at instanceof Date ? row.created_at : new Date(row.created_at)
  return User.create(row.id, { email: email.value, name: row.name, image: row.image, createdAt })
}

/**
 * Reads directly from better-auth's own `user` table — read-only, no
 * writes. Account creation/edits go through better-auth's own API
 * (cf. docs/adr/0004/0005), never through here.
 */
export class BetterAuthUserDirectory implements UserDirectory {
  async findById(id: string): Promise<User | null> {
    const row = await db.from('user').where('id', id).first()
    return row ? toDomain(row) : null
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return []
    const rows = await db.from('user').whereIn('id', ids)
    return rows.map(toDomain)
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await db.from('user').where('email', email.value).first()
    return row ? toDomain(row) : null
  }
}
```

- [ ] **Step 5: Create the use-cases**

```ts
// backend/src/application/identity/get-current-user.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { Session } from '#domain/identity/interfaces/session.interface'
import type { AuthenticatedUser } from '#domain/identity/authenticated-user.vo'

export interface GetCurrentUserInput {
  sessionToken: string
}

export class GetCurrentUser implements UseCase<GetCurrentUserInput, AuthenticatedUser | null> {
  constructor(private readonly session: Session) {}

  async execute(input: GetCurrentUserInput): Promise<AuthenticatedUser | null> {
    return this.session.resolve(input.sessionToken)
  }
}
```

```ts
// backend/src/application/identity/sign-out.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { Authentication } from '#domain/identity/interfaces/authentication.interface'

export interface SignOutInput {
  sessionToken: string
}

export class SignOut implements UseCase<SignOutInput, void> {
  constructor(private readonly authentication: Authentication) {}

  async execute(input: SignOutInput): Promise<void> {
    await this.authentication.signOut(input.sessionToken)
  }
}
```

```ts
// backend/src/application/identity/get-auth-methods.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { AuthMethodsProvider } from '#domain/identity/interfaces/auth-methods-provider.interface'
import type { AuthMethod } from '#domain/identity/auth-method.vo'

export class GetAuthMethods implements UseCase<void, AuthMethod[]> {
  constructor(private readonly provider: AuthMethodsProvider) {}

  async execute(): Promise<AuthMethod[]> {
    return this.provider.resolve()
  }
}
```

- [ ] **Step 6: Create the presentation shared helpers**

```ts
// backend/src/presentation/shared/auth-context.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { AuthenticatedUser } from '#domain/identity/authenticated-user.vo'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    authenticatedUser: AuthenticatedUser | null
  }
}

export function getAuthenticatedUser(ctx: HttpContext): AuthenticatedUser | null {
  return ctx.authenticatedUser
}

export function requireAuthenticatedUser(ctx: HttpContext): AuthenticatedUser {
  const user = getAuthenticatedUser(ctx)
  if (!user) {
    throw Object.assign(new Error('Authentication required.'), {
      status: 401,
      code: 'unauthenticated',
    })
  }
  return user
}
```

```ts
// backend/src/presentation/shared/error-serializer.ts
import type { ValidationError } from '#domain/shared/validation-error'

export interface SerializedError {
  status: number
  body: { error: { type: string; message: string; details?: unknown } }
}

const STRING_ERROR_STATUS: Record<string, number> = {
  invalid_credentials: 401,
}

const STRING_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe invalide.',
}

function isValidationError(error: unknown): error is ValidationError {
  return typeof error === 'object' && error !== null && 'field' in error && 'message' in error
}

/**
 * Converts a domain/application `Result.err(...)` value into an HTTP status
 * + JSON body. Household errors (Task 10) extend `STRING_ERROR_STATUS`/
 * `STRING_ERROR_MESSAGES` in place rather than duplicating this function.
 */
export function serializeError(error: unknown): SerializedError {
  if (isValidationError(error)) {
    return { status: 400, body: { error: { type: 'validation_failed', message: error.message } } }
  }

  if (typeof error === 'string') {
    return {
      status: STRING_ERROR_STATUS[error] ?? 400,
      body: { error: { type: error, message: STRING_ERROR_MESSAGES[error] ?? error } },
    }
  }

  throw new Error(`serializeError: unrecognized domain error shape: ${JSON.stringify(error)}`)
}
```

- [ ] **Step 7: Create the identity routes and controllers**

```ts
// backend/src/presentation/identity/auth.routes.ts
import router from '@adonisjs/core/services/router'
import type { HttpContext } from '@adonisjs/core/http'

const SessionController = () => import('./session.controller.js')
const AuthMethodsController = () => import('./auth-methods.controller.js')

async function toFetchRequest(ctx: HttpContext): Promise<Request> {
  const headers = new Headers()
  for (const [key, value] of Object.entries(ctx.request.headers())) {
    if (value === undefined) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }

  const method = ctx.request.method()
  const hasBody = method !== 'GET' && method !== 'HEAD'

  return new Request(ctx.request.completeUrl(true), {
    method,
    headers,
    body: hasBody ? (ctx.request.raw() ?? undefined) : undefined,
  })
}

async function sendFetchResponse(response: Response, ctx: HttpContext): Promise<void> {
  ctx.response.status(response.status)
  response.headers.forEach((value, key) => ctx.response.header(key, value))
  ctx.response.send(Buffer.from(await response.arrayBuffer()))
}

/**
 * better-auth owns everything under `/api/auth/*` (email/password sign-up &
 * sign-in, OIDC callback, sign-out) via its own Fetch-API handler — this
 * only bridges Adonis's Node request/response into a `Request`/`Response`
 * pair. Resolves `identity.authHandler` from the container rather than
 * importing `#infrastructure/auth/better-auth/instance` directly — this
 * file lives in `src/presentation`, which the dependency-cruiser boundary
 * rule (Task 11) forbids from depending on `src/infrastructure` (cf.
 * docs/adr/0002). Uses `ctx.request.raw()` rather than the live Node
 * stream, since `bodyparser_middleware` has already consumed the original
 * `IncomingMessage` by the time this route runs.
 */
router.any('/api/auth/*', async (ctx: HttpContext) => {
  const authHandler = await ctx.containerResolver.make('identity.authHandler')
  const response = await authHandler(await toFetchRequest(ctx))
  await sendFetchResponse(response, ctx)
})

router.get('/api/session', [SessionController, 'show'])
router.get('/api/auth/methods', [AuthMethodsController, 'index'])
```

```ts
// backend/src/presentation/identity/session.controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { getAuthenticatedUser } from '#presentation/shared/auth-context'

export default class SessionController {
  async show(ctx: HttpContext) {
    const user = getAuthenticatedUser(ctx)
    return ctx.response.json({
      user: user ? { id: user.id, email: user.email.value, name: user.name } : null,
    })
  }
}
```

```ts
// backend/src/presentation/identity/auth-methods.controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { GetAuthMethods } from '#application/identity/get-auth-methods.use-case'

export default class AuthMethodsController {
  async index(ctx: HttpContext) {
    const provider = await ctx.containerResolver.make('identity.authMethodsProvider')
    const methods = await new GetAuthMethods(provider).execute()
    return ctx.response.json({
      methods: methods.map((m) => ({ id: m.id, enabled: m.enabled, label: m.label })),
    })
  }
}
```

- [ ] **Step 8: Create the identity provider (DI bindings)**

```ts
// backend/providers/identity_provider.ts
import type { ApplicationService } from '@adonisjs/core/types'
import type { UserDirectory } from '#domain/identity/interfaces/user-directory.interface'
import type { Authentication } from '#domain/identity/interfaces/authentication.interface'
import type { Session } from '#domain/identity/interfaces/session.interface'
import type { AuthMethodsProvider } from '#domain/identity/interfaces/auth-methods-provider.interface'

export default class IdentityProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('identity.userDirectory', async () => {
      const { BetterAuthUserDirectory } = await import(
        '#infrastructure/database/identity/user-directory.repository'
      )
      return new BetterAuthUserDirectory()
    })

    this.app.container.singleton('identity.authentication', async () => {
      const { BetterAuthAuthentication } = await import(
        '#infrastructure/auth/better-auth/authentication.adapter'
      )
      return new BetterAuthAuthentication()
    })

    this.app.container.singleton('identity.session', async () => {
      const { BetterAuthSession } = await import('#infrastructure/auth/better-auth/session.adapter')
      return new BetterAuthSession()
    })

    this.app.container.singleton('identity.authMethodsProvider', async () => {
      const { EnvAuthMethodsProvider } = await import('#infrastructure/auth/auth-methods.provider')
      return new EnvAuthMethodsProvider()
    })

    this.app.container.singleton('identity.authHandler', async () => {
      const { auth } = await import('#infrastructure/auth/better-auth/instance')
      return (request: Request) => auth.handler(request)
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'identity.userDirectory': UserDirectory
    'identity.authentication': Authentication
    'identity.session': Session
    'identity.authMethodsProvider': AuthMethodsProvider
    'identity.authHandler': (request: Request) => Promise<Response>
  }
}
```

- [ ] **Step 9: Replace the temporary auth middleware**

```ts
// backend/app/middleware/auth_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import app from '@adonisjs/core/services/app'

/**
 * Registered globally in kernel.ts (router.use, not a named middleware) so
 * `ctx.authenticatedUser` is always set — to `null` when there's no valid
 * session — before any controller runs.
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const cookie = ctx.request.header('cookie')
    if (!cookie) {
      ctx.authenticatedUser = null
      return next()
    }

    const session = await app.container.make('identity.session')
    ctx.authenticatedUser = await session.resolve(cookie)
    return next()
  }
}
```

- [ ] **Step 10: Wire the identity routes**

```ts
// backend/start/routes.ts
import '#presentation/health.routes'
import '#presentation/identity/auth.routes'
```

- [ ] **Step 11: Add `identity_provider` to `adonisrc.ts` providers list**

Already present from Task 2's `adonisrc.ts` (`() => import('#providers/identity_provider')`)
— no edit needed. Verify it's there before continuing.

- [ ] **Step 12: Write the functional test**

```ts
// backend/tests/functional/identity/auth.spec.ts
import { test } from '@japa/runner'

test.group('identity: sign-up, session, sign-out, auth methods', () => {
  test('GET /api/auth/methods lists password when PocketID is not configured', async ({
    client,
  }) => {
    const response = await client.get('/api/auth/methods')
    response.assertStatus(200)
    response.assertBodyContains({ methods: [{ id: 'password', enabled: true }] })
  })

  test('GET /api/session returns null before sign-in', async ({ client }) => {
    const response = await client.get('/api/session')
    response.assertStatus(200)
    response.assertBodyContains({ user: null })
  })

  test('sign-up then session reflects the new user, sign-out clears it', async ({
    client,
    assert,
  }) => {
    const signUp = await client.post('/api/auth/sign-up/email').json({
      email: 'alice@example.com',
      password: 'correct-horse-battery-staple',
      name: 'Alice',
    })
    signUp.assertStatus(200)

    const cookie = signUp.headers()['set-cookie']
    assert.isDefined(cookie)

    const session = await client.get('/api/session').headers({ cookie })
    session.assertStatus(200)
    session.assertBodyContains({ user: { email: 'alice@example.com', name: 'Alice' } })

    const signOut = await client.post('/api/auth/sign-out').headers({ cookie })
    signOut.assertStatus(200)

    const afterSignOut = await client.get('/api/session').headers({ cookie })
    afterSignOut.assertBodyContains({ user: null })
  })
})
```

- [ ] **Step 13: Run the test to verify it fails, then passes**

Run: `cd backend && node ace migration:fresh && node ace test functional`
Expected: first run may fail if any wiring step above was skipped (check the error
against the step list); once all steps are in place, PASS (4 tests).

- [ ] **Step 14: Commit**

```bash
git add backend/src/infrastructure/auth backend/src/infrastructure/database/identity backend/src/application/identity backend/src/presentation/shared backend/src/presentation/identity backend/providers/identity_provider.ts backend/app/middleware/auth_middleware.ts backend/start/routes.ts backend/tests/functional/identity
git commit -m "feat(identity): better-auth wiring (password + PocketID), session, auth methods"
```

---

## Task 8: Household domain

**Files:**
- Create: `backend/src/domain/identity/household-role.vo.ts`
- Create: `backend/src/domain/identity/invite-code.vo.ts`
- Create: `backend/src/domain/identity/household-member.entity.ts`
- Create: `backend/src/domain/identity/household.aggregate.ts`
- Create: `backend/src/domain/identity/interfaces/household-repository.interface.ts`
- Test: `backend/tests/unit/domain/identity/invite-code.vo.spec.ts`
- Test: `backend/tests/unit/domain/identity/household.aggregate.spec.ts`

**Interfaces:**
- Consumes: `Entity`, `AggregateRoot`, `ValueObject`, `Result`, `ValidationError`
  (Task 4), `IdGenerator` (Task 4, used by tests/callers, not by the aggregate
  itself).
- Produces: `HouseholdRole = 'owner' | 'member'`. `InviteCode.create(raw): Result<InviteCode,
  ValidationError>`, `InviteCode.generate(idGenerator): InviteCode`, `.value: string`.
  `HouseholdMember.create(id, { userId, householdId, role, joinedAt }): HouseholdMember`.
  `Household.create({ id, name, ownerId, ownerMemberId, inviteCode, createdAt }): Household`,
  `Household.reconstruct(id, props): Household`, `.name`, `.ownerId`, `.inviteCode`,
  `.members: HouseholdMember[]`, `.createdAt`, `.regenerateInviteCode(newCode)`,
  `.addMember(memberId, userId, joinedAt): Result<void, 'already_member'>`,
  `.removeMember(userId): Result<void, 'cannot_remove_owner' | 'not_a_member'>`.
  Interface `HouseholdRepository` — implemented in Task 9.

- [ ] **Step 1: Write the failing tests**

```ts
// backend/tests/unit/domain/identity/invite-code.vo.spec.ts
import { test } from '@japa/runner'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { UuidIdGenerator } from '#infrastructure/shared/uuid-id-generator'

test.group('InviteCode', () => {
  test('accepts an 8-character alphanumeric code, normalized to uppercase', ({ assert }) => {
    const result = InviteCode.create('k3f9qx2a')
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value.value, 'K3F9QX2A')
  })

  test('rejects a code that is not 8 characters', ({ assert }) => {
    const result = InviteCode.create('short')
    assert.isFalse(result.ok)
  })

  test('generate() produces a valid 8-character code', ({ assert }) => {
    const code = InviteCode.generate(new UuidIdGenerator())
    assert.match(code.value, /^[A-Z0-9]{8}$/)
  })
})
```

```ts
// backend/tests/unit/domain/identity/household.aggregate.spec.ts
import { test } from '@japa/runner'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'

function buildHousehold() {
  const inviteCodeResult = InviteCode.create('AAAA1111')
  if (!inviteCodeResult.ok) throw new Error('unreachable')

  return Household.create({
    id: 'h_1',
    name: 'Chez nous',
    ownerId: 'u_owner',
    ownerMemberId: 'm_owner',
    inviteCode: inviteCodeResult.value,
    createdAt: new Date('2026-08-25T10:00:00Z'),
  })
}

test.group('Household', () => {
  test('create() seeds the owner as its first member', ({ assert }) => {
    const household = buildHousehold()
    assert.lengthOf(household.members, 1)
    assert.equal(household.members[0]?.userId, 'u_owner')
    assert.equal(household.members[0]?.role, 'owner')
  })

  test('addMember() adds a new member with role "member"', ({ assert }) => {
    const household = buildHousehold()
    const result = household.addMember('m_bob', 'u_bob', new Date('2026-08-25T11:00:00Z'))
    assert.isTrue(result.ok)
    assert.lengthOf(household.members, 2)
    assert.equal(household.members[1]?.role, 'member')
  })

  test('addMember() rejects a userId already a member', ({ assert }) => {
    const household = buildHousehold()
    const result = household.addMember('m_owner_dup', 'u_owner', new Date())
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'already_member')
  })

  test('removeMember() rejects removing the owner', ({ assert }) => {
    const household = buildHousehold()
    const result = household.removeMember('u_owner')
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'cannot_remove_owner')
  })

  test('removeMember() removes a non-owner member', ({ assert }) => {
    const household = buildHousehold()
    household.addMember('m_bob', 'u_bob', new Date())
    const result = household.removeMember('u_bob')
    assert.isTrue(result.ok)
    assert.lengthOf(household.members, 1)
  })

  test('removeMember() rejects a userId that is not a member', ({ assert }) => {
    const household = buildHousehold()
    const result = household.removeMember('u_unknown')
    assert.isFalse(result.ok)
    if (!result.ok) assert.equal(result.error, 'not_a_member')
  })

  test('regenerateInviteCode() replaces the invite code', ({ assert }) => {
    const household = buildHousehold()
    const newCodeResult = InviteCode.create('BBBB2222')
    if (!newCodeResult.ok) throw new Error('unreachable')
    household.regenerateInviteCode(newCodeResult.value)
    assert.equal(household.inviteCode.value, 'BBBB2222')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && node ace test unit`
Expected: FAIL with "Cannot find module '#domain/identity/invite-code.vo'" (and
`household.aggregate`).

- [ ] **Step 3: Implement the household domain**

```ts
// backend/src/domain/identity/household-role.vo.ts
export type HouseholdRole = 'owner' | 'member'
```

```ts
// backend/src/domain/identity/invite-code.vo.ts
import { ValueObject } from '#domain/shared/value-object'
import { Result } from '#domain/shared/result'
import type { ValidationError } from '#domain/shared/validation-error'
import type { IdGenerator } from '#domain/shared/id-generator.interface'

const INVITE_CODE_PATTERN = /^[A-Z0-9]{8}$/

interface InviteCodeProps {
  value: string
}

export class InviteCode extends ValueObject<InviteCodeProps> {
  private constructor(props: InviteCodeProps) {
    super(props)
  }

  static create(raw: string): Result<InviteCode, ValidationError> {
    const normalized = raw.trim().toUpperCase()
    if (!INVITE_CODE_PATTERN.test(normalized)) {
      return Result.err({
        field: 'inviteCode',
        message: `"${raw}" n'est pas un code d'invitation valide`,
      })
    }
    return Result.ok(new InviteCode({ value: normalized }))
  }

  /**
   * Derives an 8-character code from a fresh id rather than calling
   * `Math.random()`/`crypto` directly — keeps the domain testable through
   * the same `IdGenerator` port every other id comes from.
   */
  static generate(idGenerator: IdGenerator): InviteCode {
    const raw = idGenerator
      .next()
      .replace(/-/g, '')
      .toUpperCase()
      .slice(0, 8)
      .padEnd(8, '0')
    return new InviteCode({ value: raw })
  }

  get value(): string {
    return this.props.value
  }
}
```

```ts
// backend/src/domain/identity/household-member.entity.ts
import { Entity } from '#domain/shared/entity'
import type { HouseholdRole } from './household-role.vo.js'

interface HouseholdMemberProps {
  userId: string
  householdId: string
  role: HouseholdRole
  joinedAt: Date
}

export class HouseholdMember extends Entity<string> {
  private props: HouseholdMemberProps

  private constructor(id: string, props: HouseholdMemberProps) {
    super(id)
    this.props = props
  }

  static create(id: string, props: HouseholdMemberProps): HouseholdMember {
    return new HouseholdMember(id, props)
  }

  get userId(): string {
    return this.props.userId
  }

  get householdId(): string {
    return this.props.householdId
  }

  get role(): HouseholdRole {
    return this.props.role
  }

  get joinedAt(): Date {
    return this.props.joinedAt
  }
}
```

```ts
// backend/src/domain/identity/household.aggregate.ts
import { AggregateRoot } from '#domain/shared/aggregate-root'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import { HouseholdMember } from './household-member.entity.js'
import type { InviteCode } from './invite-code.vo.js'

interface HouseholdProps {
  name: string
  ownerId: string
  inviteCode: InviteCode
  members: HouseholdMember[]
  createdAt: Date
}

export class Household extends AggregateRoot<string> {
  private props: HouseholdProps

  private constructor(id: string, props: HouseholdProps) {
    super(id)
    this.props = props
  }

  static create(params: {
    id: string
    name: string
    ownerId: string
    ownerMemberId: string
    inviteCode: InviteCode
    createdAt: Date
  }): Household {
    const owner = HouseholdMember.create(params.ownerMemberId, {
      userId: params.ownerId,
      householdId: params.id,
      role: 'owner',
      joinedAt: params.createdAt,
    })

    return new Household(params.id, {
      name: params.name,
      ownerId: params.ownerId,
      inviteCode: params.inviteCode,
      members: [owner],
      createdAt: params.createdAt,
    })
  }

  /** Rehydrates an aggregate from persisted state — used by the mapper (Task 9). */
  static reconstruct(id: string, props: HouseholdProps): Household {
    return new Household(id, props)
  }

  get name(): string {
    return this.props.name
  }

  get ownerId(): string {
    return this.props.ownerId
  }

  get inviteCode(): InviteCode {
    return this.props.inviteCode
  }

  get members(): HouseholdMember[] {
    return this.props.members
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  regenerateInviteCode(newCode: InviteCode): void {
    this.props.inviteCode = newCode
  }

  addMember(memberId: string, userId: string, joinedAt: Date): ResultType<void, 'already_member'> {
    if (this.props.members.some((m) => m.userId === userId)) {
      return Result.err('already_member')
    }
    this.props.members.push(
      HouseholdMember.create(memberId, { userId, householdId: this.id, role: 'member', joinedAt }),
    )
    return Result.ok(undefined)
  }

  removeMember(userId: string): ResultType<void, 'cannot_remove_owner' | 'not_a_member'> {
    if (userId === this.props.ownerId) {
      return Result.err('cannot_remove_owner')
    }
    const index = this.props.members.findIndex((m) => m.userId === userId)
    if (index === -1) {
      return Result.err('not_a_member')
    }
    this.props.members.splice(index, 1)
    return Result.ok(undefined)
  }
}
```

```ts
// backend/src/domain/identity/interfaces/household-repository.interface.ts
import type { Household } from '../household.aggregate.js'
import type { InviteCode } from '../invite-code.vo.js'

export interface HouseholdRepository {
  findById(id: string): Promise<Household | null>
  findByUserId(userId: string): Promise<Household | null>
  findByInviteCode(code: InviteCode): Promise<Household | null>
  save(household: Household): Promise<void>
  delete(id: string): Promise<void>
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && node ace test unit`
Expected: PASS (10 new tests, 17 total)

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/identity backend/tests/unit/domain/identity
git commit -m "feat(household): domain aggregate (Household, HouseholdMember, InviteCode)"
```

---

## Task 9: Household persistence + household_required_middleware

**Files:**
- Create: `backend/src/infrastructure/database/identity/household.lucid.ts`
- Create: `backend/src/infrastructure/database/identity/household_member.lucid.ts`
- Create: `backend/src/infrastructure/database/identity/household.mapper.ts`
- Create: `backend/src/infrastructure/database/identity/household.repository.ts`
- Modify: `backend/providers/identity_provider.ts` (add the `identity.households` binding)
- Modify: `backend/app/middleware/household_required_middleware.ts` (replace the
  Task 2 no-op)
- Test: `backend/tests/infrastructure/identity/household.repository.spec.ts`

**Interfaces:**
- Consumes: `Household`, `HouseholdMember`, `InviteCode`, `HouseholdRepository`
  (Task 8).
- Produces: `LucidHouseholdRepository implements HouseholdRepository`. Container
  binding `identity.households: HouseholdRepository` — consumed by Task 10's
  use-cases/controller. `ctx.household: Household` set by
  `household_required_middleware` (not attached to any route yet — Phase 2 onward).

- [ ] **Step 1: Create the Lucid models**

```ts
// backend/src/infrastructure/database/identity/household_member.lucid.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class HouseholdMemberModel extends BaseModel {
  static table = 'household_member'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'user_id' })
  declare userId: string

  @column()
  declare role: 'owner' | 'member'

  @column.dateTime({ columnName: 'joined_at', autoCreate: true })
  declare joinedAt: DateTime
}
```

```ts
// backend/src/infrastructure/database/identity/household.lucid.ts
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import HouseholdMemberModel from './household_member.lucid.js'

export default class HouseholdModel extends BaseModel {
  static table = 'household'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column({ columnName: 'owner_id' })
  declare ownerId: string

  @column({ columnName: 'invite_code' })
  declare inviteCode: string

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => HouseholdMemberModel, { foreignKey: 'householdId' })
  declare members: HasMany<typeof HouseholdMemberModel>
}
```

- [ ] **Step 2: Create the mapper**

```ts
// backend/src/infrastructure/database/identity/household.mapper.ts
import { Household } from '#domain/identity/household.aggregate'
import { HouseholdMember } from '#domain/identity/household-member.entity'
import { InviteCode } from '#domain/identity/invite-code.vo'
import type HouseholdModel from './household.lucid.js'

export function toDomain(row: HouseholdModel): Household {
  const inviteCode = InviteCode.create(row.inviteCode)
  if (!inviteCode.ok) {
    throw new Error(`Corrupted household row ${row.id}: ${inviteCode.error.message}`)
  }

  const members = row.members.map((m) =>
    HouseholdMember.create(m.id, {
      userId: m.userId,
      householdId: m.householdId,
      role: m.role,
      joinedAt: m.joinedAt.toJSDate(),
    }),
  )

  return Household.reconstruct(row.id, {
    name: row.name,
    ownerId: row.ownerId,
    inviteCode: inviteCode.value,
    members,
    createdAt: row.createdAt.toJSDate(),
  })
}
```

- [ ] **Step 3: Create the repository**

```ts
// backend/src/infrastructure/database/identity/household.repository.ts
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import HouseholdModel from './household.lucid.js'
import HouseholdMemberModel from './household_member.lucid.js'
import { toDomain } from './household.mapper.js'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { Household } from '#domain/identity/household.aggregate'
import type { InviteCode } from '#domain/identity/invite-code.vo'

export class LucidHouseholdRepository implements HouseholdRepository {
  async findById(id: string): Promise<Household | null> {
    const row = await HouseholdModel.query().where('id', id).preload('members').first()
    return row ? toDomain(row) : null
  }

  async findByUserId(userId: string): Promise<Household | null> {
    const member = await HouseholdMemberModel.query().where('user_id', userId).first()
    if (!member) return null
    return this.findById(member.householdId)
  }

  async findByInviteCode(code: InviteCode): Promise<Household | null> {
    const row = await HouseholdModel.query()
      .where('invite_code', code.value)
      .preload('members')
      .first()
    return row ? toDomain(row) : null
  }

  async save(household: Household): Promise<void> {
    await db.transaction(async (trx) => {
      await HouseholdModel.updateOrCreate(
        { id: household.id },
        { name: household.name, ownerId: household.ownerId, inviteCode: household.inviteCode.value },
        { client: trx },
      )

      const existingRows = await HouseholdMemberModel.query({ client: trx }).where(
        'household_id',
        household.id,
      )
      const currentIds = new Set(household.members.map((m) => m.id))

      const removedIds = existingRows.filter((row) => !currentIds.has(row.id)).map((row) => row.id)
      if (removedIds.length > 0) {
        await HouseholdMemberModel.query({ client: trx }).whereIn('id', removedIds).delete()
      }

      for (const member of household.members) {
        await HouseholdMemberModel.updateOrCreate(
          { id: member.id },
          {
            householdId: member.householdId,
            userId: member.userId,
            role: member.role,
            joinedAt: DateTime.fromJSDate(member.joinedAt),
          },
          { client: trx },
        )
      }
    })
  }

  async delete(id: string): Promise<void> {
    await HouseholdModel.query().where('id', id).delete()
  }
}
```

- [ ] **Step 4: Add the `identity.households` binding**

```ts
// backend/providers/identity_provider.ts
// Add this import alongside the existing ones:
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'

// Add inside register(), alongside the existing singletons:
    this.app.container.singleton('identity.households', async () => {
      const { LucidHouseholdRepository } = await import(
        '#infrastructure/database/identity/household.repository'
      )
      return new LucidHouseholdRepository()
    })

// Add inside the ContainerBindings interface augmentation:
    'identity.households': HouseholdRepository
```

- [ ] **Step 5: Replace the temporary household_required_middleware**

```ts
// backend/app/middleware/household_required_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Household } from '#domain/identity/household.aggregate'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    household: Household
  }
}

/**
 * Attached to route groups scoped to a household's own data (fridge,
 * receipts, shopping list, recipes — Phase 2 onward). Not used by any
 * Phase 1 route: the household endpoints themselves (create/join/mine) must
 * keep working for a user who has no household yet.
 */
export default class HouseholdRequiredMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = requireAuthenticatedUser(ctx)
    const households = await ctx.containerResolver.make('identity.households')
    const household = await households.findByUserId(user.id)

    if (!household) {
      ctx.response.status(403).json({
        error: { type: 'no_household', message: "Vous n'appartenez à aucun foyer." },
      })
      return
    }

    ctx.household = household
    return next()
  }
}
```

- [ ] **Step 6: Write the infrastructure test**

```ts
// backend/tests/infrastructure/identity/household.repository.spec.ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { LucidHouseholdRepository } from '#infrastructure/database/identity/household.repository'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'

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

test.group('LucidHouseholdRepository', (group) => {
  group.each.setup(() => db.beginGlobalTransaction())
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('save() then findByUserId() round-trips a household with its owner', async ({ assert }) => {
    await createUser('u_1', 'owner@example.com')
    const inviteCode = InviteCode.create('AAAA1111')
    if (!inviteCode.ok) throw new Error('unreachable')

    const household = Household.create({
      id: 'h_1',
      name: 'Chez nous',
      ownerId: 'u_1',
      ownerMemberId: 'm_1',
      inviteCode: inviteCode.value,
      createdAt: new Date(),
    })

    const repository = new LucidHouseholdRepository()
    await repository.save(household)

    const found = await repository.findByUserId('u_1')
    assert.isNotNull(found)
    assert.equal(found?.name, 'Chez nous')
    assert.lengthOf(found?.members ?? [], 1)
    assert.equal(found?.members[0]?.role, 'owner')
  })

  test('save() persists a removed member as actually removed', async ({ assert }) => {
    await createUser('u_2', 'owner2@example.com')
    await createUser('u_3', 'member@example.com')
    const inviteCode = InviteCode.create('BBBB2222')
    if (!inviteCode.ok) throw new Error('unreachable')

    const household = Household.create({
      id: 'h_2',
      name: 'Autre foyer',
      ownerId: 'u_2',
      ownerMemberId: 'm_2',
      inviteCode: inviteCode.value,
      createdAt: new Date(),
    })
    household.addMember('m_3', 'u_3', new Date())

    const repository = new LucidHouseholdRepository()
    await repository.save(household)

    const reloaded = await repository.findByUserId('u_2')
    reloaded?.removeMember('u_3')
    if (reloaded) await repository.save(reloaded)

    const final = await repository.findByUserId('u_2')
    assert.lengthOf(final?.members ?? [], 1)

    const goneMember = await repository.findByUserId('u_3')
    assert.isNull(goneMember)
  })

  test('findByInviteCode() finds a household by its code', async ({ assert }) => {
    await createUser('u_4', 'owner4@example.com')
    const inviteCode = InviteCode.create('CCCC3333')
    if (!inviteCode.ok) throw new Error('unreachable')

    const household = Household.create({
      id: 'h_3',
      name: 'Foyer 3',
      ownerId: 'u_4',
      ownerMemberId: 'm_4',
      inviteCode: inviteCode.value,
      createdAt: new Date(),
    })

    const repository = new LucidHouseholdRepository()
    await repository.save(household)

    const found = await repository.findByInviteCode(inviteCode.value)
    assert.equal(found?.id, 'h_3')
  })
})
```

- [ ] **Step 7: Run the test**

Run: `cd backend && node ace test infrastructure`
Expected: PASS (3 tests). If `node ace test infrastructure` reports no matching
suite, add `'tests/infrastructure/**/*.spec.{ts,js}'` to the `unit` suite's `files`
array in `adonisrc.ts` (it should already be covered — cf. Task 2 Step 3 — verify
before adding a duplicate entry).

- [ ] **Step 8: Commit**

```bash
git add backend/src/infrastructure/database/identity backend/providers/identity_provider.ts backend/app/middleware/household_required_middleware.ts backend/tests/infrastructure/identity
git commit -m "feat(household): Lucid persistence, household_required_middleware"
```

---

## Task 10: Household use-cases + presentation + end-to-end functional test

**Files:**
- Create: `backend/src/application/identity/create-household.use-case.ts`
- Create: `backend/src/application/identity/join-household.use-case.ts`
- Create: `backend/src/application/identity/get-my-household.use-case.ts`
- Create: `backend/src/application/identity/regenerate-invite-code.use-case.ts`
- Create: `backend/src/application/identity/remove-household-member.use-case.ts`
- Create: `backend/src/application/identity/leave-household.use-case.ts`
- Create: `backend/src/application/identity/delete-household.use-case.ts`
- Create: `backend/src/presentation/identity/household.dto.ts`
- Create: `backend/src/presentation/identity/household.validator.ts`
- Create: `backend/src/presentation/identity/household.controller.ts`
- Create: `backend/src/presentation/identity/household.routes.ts`
- Modify: `backend/src/presentation/shared/error-serializer.ts` (extend the error maps)
- Modify: `backend/start/routes.ts` (add the household routes import)
- Test: `backend/tests/functional/identity/household.spec.ts`

**Interfaces:**
- Consumes: `HouseholdRepository` (Task 9), `Household`, `HouseholdMember`,
  `InviteCode` (Task 8), `Clock`, `IdGenerator` (Task 4), `UserDirectory` (Task 6/7).
- Produces: `GET /api/households/mine`, `POST /api/households`, `POST
  /api/households/join`, `POST /api/households/invite-code/regenerate`, `DELETE
  /api/households/members/:userId`, `POST /api/households/leave`, `DELETE
  /api/households/mine` — matching `docs/phase-0/04-endpoints-http.md`.

- [ ] **Step 1: Create the use-cases**

```ts
// backend/src/application/identity/create-household.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface CreateHouseholdInput {
  userId: string
  name: string
}

export type CreateHouseholdError = 'already_in_household'

export class CreateHousehold
  implements UseCase<CreateHouseholdInput, ResultType<Household, CreateHouseholdError>>
{
  constructor(
    private readonly households: HouseholdRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateHouseholdInput): Promise<ResultType<Household, CreateHouseholdError>> {
    const existing = await this.households.findByUserId(input.userId)
    if (existing) return Result.err('already_in_household')

    const household = Household.create({
      id: this.idGenerator.next(),
      name: input.name,
      ownerId: input.userId,
      ownerMemberId: this.idGenerator.next(),
      inviteCode: InviteCode.generate(this.idGenerator),
      createdAt: this.clock.now(),
    })

    await this.households.save(household)
    return Result.ok(household)
  }
}
```

```ts
// backend/src/application/identity/join-household.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface JoinHouseholdInput {
  userId: string
  inviteCode: string
}

export type JoinHouseholdError = 'already_in_household' | 'invalid_invite_code'

export class JoinHousehold
  implements UseCase<JoinHouseholdInput, ResultType<Household, JoinHouseholdError>>
{
  constructor(
    private readonly households: HouseholdRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: JoinHouseholdInput): Promise<ResultType<Household, JoinHouseholdError>> {
    const existing = await this.households.findByUserId(input.userId)
    if (existing) return Result.err('already_in_household')

    const codeResult = InviteCode.create(input.inviteCode)
    if (!codeResult.ok) return Result.err('invalid_invite_code')

    const household = await this.households.findByInviteCode(codeResult.value)
    if (!household) return Result.err('invalid_invite_code')

    const added = household.addMember(this.idGenerator.next(), input.userId, this.clock.now())
    if (!added.ok) return Result.err('already_in_household')

    await this.households.save(household)
    return Result.ok(household)
  }
}
```

```ts
// backend/src/application/identity/get-my-household.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { Household } from '#domain/identity/household.aggregate'

export interface GetMyHouseholdInput {
  userId: string
}

export class GetMyHousehold implements UseCase<GetMyHouseholdInput, Household | null> {
  constructor(private readonly households: HouseholdRepository) {}

  async execute(input: GetMyHouseholdInput): Promise<Household | null> {
    return this.households.findByUserId(input.userId)
  }
}
```

```ts
// backend/src/application/identity/regenerate-invite-code.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import type { Household } from '#domain/identity/household.aggregate'

export interface RegenerateInviteCodeInput {
  userId: string
}

export type RegenerateInviteCodeError = 'no_household' | 'not_owner'

export class RegenerateInviteCode
  implements UseCase<RegenerateInviteCodeInput, ResultType<Household, RegenerateInviteCodeError>>
{
  constructor(
    private readonly households: HouseholdRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(
    input: RegenerateInviteCodeInput,
  ): Promise<ResultType<Household, RegenerateInviteCodeError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household) return Result.err('no_household')
    if (household.ownerId !== input.userId) return Result.err('not_owner')

    household.regenerateInviteCode(InviteCode.generate(this.idGenerator))
    await this.households.save(household)
    return Result.ok(household)
  }
}
```

```ts
// backend/src/application/identity/remove-household-member.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface RemoveHouseholdMemberInput {
  userId: string
  targetUserId: string
}

export type RemoveHouseholdMemberError =
  | 'no_household'
  | 'not_owner'
  | 'cannot_remove_owner'
  | 'not_a_member'

export class RemoveHouseholdMember
  implements UseCase<RemoveHouseholdMemberInput, ResultType<void, RemoveHouseholdMemberError>>
{
  constructor(private readonly households: HouseholdRepository) {}

  async execute(
    input: RemoveHouseholdMemberInput,
  ): Promise<ResultType<void, RemoveHouseholdMemberError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household) return Result.err('no_household')
    if (household.ownerId !== input.userId) return Result.err('not_owner')

    const removed = household.removeMember(input.targetUserId)
    if (!removed.ok) return Result.err(removed.error)

    await this.households.save(household)
    return Result.ok(undefined)
  }
}
```

```ts
// backend/src/application/identity/leave-household.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface LeaveHouseholdInput {
  userId: string
}

export type LeaveHouseholdError = 'no_household' | 'owner_cannot_leave'

export class LeaveHousehold implements UseCase<LeaveHouseholdInput, ResultType<void, LeaveHouseholdError>> {
  constructor(private readonly households: HouseholdRepository) {}

  async execute(input: LeaveHouseholdInput): Promise<ResultType<void, LeaveHouseholdError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household) return Result.err('no_household')
    if (household.ownerId === input.userId) return Result.err('owner_cannot_leave')

    household.removeMember(input.userId)
    await this.households.save(household)
    return Result.ok(undefined)
  }
}
```

```ts
// backend/src/application/identity/delete-household.use-case.ts
import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface DeleteHouseholdInput {
  userId: string
}

export type DeleteHouseholdError = 'no_household' | 'not_owner'

export class DeleteHousehold implements UseCase<DeleteHouseholdInput, ResultType<void, DeleteHouseholdError>> {
  constructor(private readonly households: HouseholdRepository) {}

  async execute(input: DeleteHouseholdInput): Promise<ResultType<void, DeleteHouseholdError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household) return Result.err('no_household')
    if (household.ownerId !== input.userId) return Result.err('not_owner')

    await this.households.delete(household.id)
    return Result.ok(undefined)
  }
}
```

- [ ] **Step 2: Extend the error serializer**

```ts
// backend/src/presentation/shared/error-serializer.ts
// Replace the two Record literals with:

const STRING_ERROR_STATUS: Record<string, number> = {
  invalid_credentials: 401,
  already_in_household: 409,
  invalid_invite_code: 404,
  no_household: 404,
  not_owner: 403,
  cannot_remove_owner: 409,
  not_a_member: 404,
  owner_cannot_leave: 409,
}

const STRING_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe invalide.',
  already_in_household: 'Vous appartenez déjà à un foyer.',
  invalid_invite_code: "Code d'invitation invalide.",
  no_household: "Vous n'appartenez à aucun foyer.",
  not_owner: 'Seul le propriétaire du foyer peut faire cette action.',
  cannot_remove_owner: 'Le propriétaire ne peut pas être retiré.',
  not_a_member: "Cet utilisateur n'est pas membre du foyer.",
  owner_cannot_leave: 'Le propriétaire doit supprimer le foyer plutôt que le quitter.',
}
```

- [ ] **Step 3: Create the DTO and validators**

```ts
// backend/src/presentation/identity/household.dto.ts
import type { Household } from '#domain/identity/household.aggregate'
import type { User } from '#domain/identity/user.entity'
import type { HouseholdRole } from '#domain/identity/household-role.vo'

export interface HouseholdMemberDto {
  userId: string
  name: string
  role: HouseholdRole
  joinedAt: string
}

export interface HouseholdDto {
  id: string
  name: string
  inviteCode?: string
  role: HouseholdRole
  members: HouseholdMemberDto[]
}

/**
 * `inviteCode` is only included for the caller's own role being 'owner' —
 * cf. docs/phase-0/04-endpoints-http.md.
 */
export function toHouseholdDto(
  household: Household,
  callerUserId: string,
  members: User[],
): HouseholdDto {
  const memberById = new Map(members.map((u) => [u.id, u]))
  const caller = household.members.find((m) => m.userId === callerUserId)
  if (!caller) throw new Error(`toHouseholdDto: caller ${callerUserId} is not a member`)

  return {
    id: household.id,
    name: household.name,
    role: caller.role,
    ...(caller.role === 'owner' ? { inviteCode: household.inviteCode.value } : {}),
    members: household.members.map((m) => ({
      userId: m.userId,
      name: memberById.get(m.userId)?.name ?? 'Utilisateur inconnu',
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
  }
}
```

```ts
// backend/src/presentation/identity/household.validator.ts
import vine from '@vinejs/vine'

export const createHouseholdValidator = vine.compile(
  vine.object({ name: vine.string().trim().minLength(1).maxLength(80) }),
)

export const joinHouseholdValidator = vine.compile(
  vine.object({ inviteCode: vine.string().trim().minLength(8).maxLength(8) }),
)
```

- [ ] **Step 4: Create the controller and routes**

```ts
// backend/src/presentation/identity/household.controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
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
    const households = await ctx.containerResolver.make('identity.households')
    const userDirectory = await ctx.containerResolver.make('identity.userDirectory')

    const household = await new GetMyHousehold(households).execute({ userId: user.id })
    if (!household) return ctx.response.json({ household: null })

    const members = await userDirectory.findByIds(household.members.map((m) => m.userId))
    return ctx.response.json({ household: toHouseholdDto(household, user.id, members) })
  }

  async create(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }

    const members = await userDirectory.findByIds([user.id])
    return ctx.response.status(201).json({ household: toHouseholdDto(result.value, user.id, members) })
  }

  async join(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }

    const members = await userDirectory.findByIds(result.value.members.map((m) => m.userId))
    return ctx.response.json({ household: toHouseholdDto(result.value, user.id, members) })
  }

  async regenerateInviteCode(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    const households = await ctx.containerResolver.make('identity.households')
    const idGenerator = await ctx.containerResolver.make('shared.idGenerator')

    const result = await new RegenerateInviteCode(households, idGenerator).execute({
      userId: user.id,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }

    return ctx.response.json({ inviteCode: result.value.inviteCode.value })
  }

  async removeMember(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    const households = await ctx.containerResolver.make('identity.households')

    const result = await new RemoveHouseholdMember(households).execute({
      userId: user.id,
      targetUserId: ctx.params.userId,
    })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }

    return ctx.response.status(204).send('')
  }

  async leave(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    const households = await ctx.containerResolver.make('identity.households')

    const result = await new LeaveHousehold(households).execute({ userId: user.id })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }

    return ctx.response.status(204).send('')
  }

  async destroy(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    const households = await ctx.containerResolver.make('identity.households')

    const result = await new DeleteHousehold(households).execute({ userId: user.id })
    if (!result.ok) {
      const { status, body } = serializeError(result.error)
      return ctx.response.status(status).json(body)
    }

    return ctx.response.status(204).send('')
  }
}
```

```ts
// backend/src/presentation/identity/household.routes.ts
import router from '@adonisjs/core/services/router'

const HouseholdController = () => import('./household.controller.js')

router.get('/api/households/mine', [HouseholdController, 'mine'])
router.post('/api/households', [HouseholdController, 'create'])
router.post('/api/households/join', [HouseholdController, 'join'])
router.post('/api/households/invite-code/regenerate', [HouseholdController, 'regenerateInviteCode'])
router.delete('/api/households/members/:userId', [HouseholdController, 'removeMember'])
router.post('/api/households/leave', [HouseholdController, 'leave'])
router.delete('/api/households/mine', [HouseholdController, 'destroy'])
```

- [ ] **Step 5: Wire the household routes**

```ts
// backend/start/routes.ts
import '#presentation/health.routes'
import '#presentation/identity/auth.routes'
import '#presentation/identity/household.routes'
```

- [ ] **Step 6: Write the end-to-end functional test**

```ts
// backend/tests/functional/identity/household.spec.ts
import { test } from '@japa/runner'

async function signUp(client: any, email: string, name: string) {
  const response = await client
    .post('/api/auth/sign-up/email')
    .json({ email, password: 'correct-horse-battery-staple', name })
  return response.headers()['set-cookie']
}

test.group('household: create, join, manage members', () => {
  test('a fresh user has no household', async ({ client, assert }) => {
    const cookie = await signUp(client, 'nohousehold@example.com', 'Nobody')
    const response = await client.get('/api/households/mine').headers({ cookie })
    response.assertStatus(200)
    response.assertBodyContains({ household: null })
  })

  test('create → mine → invite code visible to owner', async ({ client, assert }) => {
    const cookie = await signUp(client, 'owner@example.com', 'Owner')

    const create = await client.post('/api/households').headers({ cookie }).json({ name: 'Chez nous' })
    create.assertStatus(201)
    const inviteCode = create.body().household.inviteCode
    assert.isString(inviteCode)

    const mine = await client.get('/api/households/mine').headers({ cookie })
    mine.assertBodyContains({ household: { name: 'Chez nous', role: 'owner' } })
  })

  test('creating a second household for the same owner fails', async ({ client }) => {
    const cookie = await signUp(client, 'owner2@example.com', 'Owner2')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer A' })

    const second = await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer B' })
    second.assertStatus(409)
    second.assertBodyContains({ error: { type: 'already_in_household' } })
  })

  test('join with a valid invite code adds the member, without exposing the code to them', async ({
    client,
    assert,
  }) => {
    const ownerCookie = await signUp(client, 'owner3@example.com', 'Owner3')
    const create = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer partagé' })
    const inviteCode = create.body().household.inviteCode

    const memberCookie = await signUp(client, 'member3@example.com', 'Member3')
    const join = await client
      .post('/api/households/join')
      .headers({ cookie: memberCookie })
      .json({ inviteCode })
    join.assertStatus(200)
    join.assertBodyContains({ household: { role: 'member' } })
    assert.notProperty(join.body().household, 'inviteCode')
  })

  test('join with an invalid invite code returns 404', async ({ client }) => {
    const cookie = await signUp(client, 'joiner@example.com', 'Joiner')
    const response = await client
      .post('/api/households/join')
      .headers({ cookie })
      .json({ inviteCode: 'ZZZZ9999' })
    response.assertStatus(404)
  })

  test('owner removes a member', async ({ client }) => {
    const ownerCookie = await signUp(client, 'owner4@example.com', 'Owner4')
    const create = await client
      .post('/api/households')
      .headers({ cookie: ownerCookie })
      .json({ name: 'Foyer 4' })
    const inviteCode = create.body().household.inviteCode

    const memberCookie = await signUp(client, 'member4@example.com', 'Member4')
    await client.post('/api/households/join').headers({ cookie: memberCookie }).json({ inviteCode })

    const mineAsOwner = await client.get('/api/households/mine').headers({ cookie: ownerCookie })
    const memberUserId = mineAsOwner
      .body()
      .household.members.find((m: { role: string }) => m.role === 'member').userId

    const remove = await client
      .delete(`/api/households/members/${memberUserId}`)
      .headers({ cookie: ownerCookie })
    remove.assertStatus(204)

    const memberSession = await client.get('/api/households/mine').headers({ cookie: memberCookie })
    memberSession.assertBodyContains({ household: null })
  })

  test('owner cannot leave, must delete', async ({ client }) => {
    const cookie = await signUp(client, 'owner5@example.com', 'Owner5')
    await client.post('/api/households').headers({ cookie }).json({ name: 'Foyer 5' })

    const leave = await client.post('/api/households/leave').headers({ cookie })
    leave.assertStatus(409)
    leave.assertBodyContains({ error: { type: 'owner_cannot_leave' } })

    const destroy = await client.delete('/api/households/mine').headers({ cookie })
    destroy.assertStatus(204)

    const mine = await client.get('/api/households/mine').headers({ cookie })
    mine.assertBodyContains({ household: null })
  })
})
```

- [ ] **Step 7: Run the tests**

Run: `cd backend && node ace migration:fresh && node ace test`
Expected: PASS — all unit, infrastructure, and functional tests (health, auth,
household) green.

- [ ] **Step 8: Commit**

```bash
git add backend/src/application/identity backend/src/presentation/identity backend/src/presentation/shared/error-serializer.ts backend/start/routes.ts backend/tests/functional/identity/household.spec.ts
git commit -m "feat(household): use-cases, HTTP endpoints, end-to-end functional test"
```

---

## Task 11: Boundary lint wired into `task check`

**Files:**
- Create: `backend/.dependency-cruiser.cjs`
- Modify: `backend/package.json` (already has the `boundaries` script from Task 2 —
  verify only)

- [ ] **Step 1: Create `backend/.dependency-cruiser.cjs`**

```js
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  extends: '../.dependency-cruiser.cjs',
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: {
      path: 'node_modules',
    },
  },
}
```

- [ ] **Step 2: Run the boundary lint**

Run: `cd backend && pnpm run boundaries`
Expected: PASS, 0 violations. If a violation appears, it means an earlier task
imported across a forbidden layer boundary (most likely a presentation file
importing `#infrastructure/*` directly instead of going through
`ctx.containerResolver`) — fix the offending import before continuing, don't
suppress the rule.

- [ ] **Step 3: Run the full check suite**

Run: `cd backend && pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run boundaries`
(or, from the repo root once `task` is available: `task check`)
Expected: all four pass.

- [ ] **Step 4: Commit**

```bash
git add backend/.dependency-cruiser.cjs
git commit -m "chore(backend): wire dependency-cruiser boundary lint into task check"
```

---

## End-of-plan verification

- [ ] `task check` is green from the repo root (lint, typecheck, test, boundaries).
- [ ] `task up` builds and starts `db` + `backend` via Docker Compose; `curl
  localhost:3333/health` returns `{"status":"ok"}`.
- [ ] Manually exercise the flow once with `curl` or the `.documentation/*.http`
  files pattern (optional follow-up task, not required to close this phase): sign up
  two users, create a household as one, join it as the other with the invite code,
  confirm `GET /api/households/mine` reflects both.
- [ ] Every ADR referenced in this plan (0001, 0002, 0003, 0004, 0005) has at least
  one task whose code embodies it — reread `docs/adr/0001` through `0005` and confirm
  nothing drifted during implementation.
