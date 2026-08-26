# Mobile Phase 1 — Squelette + Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `mobile/` package (Expo + expo-router + TanStack Query + Tamagui, first commit ever) with an app shell and identity (sign-in/sign-up/sign-out, session-gated routing) — nothing else. Household onboarding and every other bounded context are later phases.

**Architecture:** Same layered discipline as `backend/` — `src/{domain,application,infrastructure,presentation}` — but domain here is plain typed data (no VO/Entity classes; nothing in this phase has behavior worth encapsulating). A single `FridgeConnector` interface is the app's one abstraction boundary over the backend, extended incrementally per phase (never a placeholder method for a context that doesn't exist yet). Two implementations: `HttpFridgeConnector` (real, wraps better-auth's official Expo client for identity) and `FakeFridgeConnector` (in-memory fixtures, for UI iteration without a backend), chosen via `EXPO_PUBLIC_CONNECTOR`.

**Tech Stack:** Expo SDK 57 (React Native 0.86), expo-router 57.x, `@tanstack/react-query` 5.102.x, Tamagui 2.7.x (`@tamagui/config/v5` preset), `better-auth` + `@better-auth/expo` (official Expo plugin — cookie jar, session cache, OAuth deep-link handling all built in, no hand-rolled storage code), `jest-expo` + `@testing-library/react-native`.

**Spec:** [`docs/superpowers/specs/2026-08-26-mobile-phase-1-identity-design.md`](../specs/2026-08-26-mobile-phase-1-identity-design.md), which defers the full `mobile/` file tree to [`docs/phase-0/01-arborescence.md`](../../phase-0/01-arborescence.md).

## Global Constraints

- `mobile/src/domain/**` has zero npm dependencies and zero dependency on `application`/`infrastructure`/`presentation` — same `domain-has-zero-dependencies` rule the root `.dependency-cruiser.cjs` already enforces for `backend/`, extended to `mobile/` in Task 1.
- `FridgeConnector` gains ONLY the 6 identity methods this phase needs (`getSession`, `getAuthMethods`, `signInEmail`, `signUpEmail`, `signInSocial`, `signOut`) — no placeholder methods for contexts built in later phases.
- All identity mutations (`signInEmail`/`signUpEmail`/`signInSocial`) return `Result<Session, ApiError>`; read-only identity queries (`getSession`/`getAuthMethods`) return their value directly (no `Result` wrapper) — mirrors how the equivalent backend endpoints never fail in a way the app needs to branch on beyond "empty/null".
- No `document.cookie` / hand-rolled cookie-jar code anywhere — session storage and the OAuth deep-link flow are entirely `@better-auth/expo`'s responsibility (`expo()` server plugin + `expoClient()` client plugin).
- Relative imports throughout `mobile/` (no TS path aliases) — this phase doesn't depend on an unconfirmed path-alias bundler configuration working on the first try.
- Every screen/component lives in `src/presentation/**`; files under `app/` (expo-router) are routing-only — they import from `src/presentation` and never contain business logic, mirroring `backend/app/` staying "pure Adonis glue" (cf. `docs/phase-0/01-arborescence.md`'s closing conventions note).
- Testing: `jest-expo` + `@testing-library/react-native`, established in Task 2, used by every subsequent task. No e2e (Detox/Maestro) in this phase.

---

### Task 1: Scaffold `mobile/`, monorepo/CI/Taskfile wiring

**Files:**
- Create: `mobile/` (via `create-expo-app`, then edited — see steps)
- Modify: `mobile/app.json`, `mobile/package.json`, `mobile/.dependency-cruiser.cjs`
- Create: `mobile/.env.example`
- Modify: `Taskfile.yml` (add `dev:mobile`, `lint:mobile`, `typecheck:mobile`, `test:mobile`, `boundaries:mobile`; extend `check`)
- Modify: `.github/workflows/ci.yml` (add a `mobile-check` job — lint/typecheck/test/boundaries, no native build, no Postgres needed)

**Interfaces:**
- Produces: a booting Expo project with `app/index.tsx` (default demo, replaced in Task 7), `mobile/package.json` scripts (`lint`, `typecheck`, `test`, `boundaries`), `mobile/.dependency-cruiser.cjs` (extends root, same shape as `backend/.dependency-cruiser.cjs`) — every later task builds inside this.

- [ ] **Step 1: Create the Expo project**

From the repo root:

```bash
npx create-expo-app@latest mobile
```

This scaffolds `mobile/` with expo-router preconfigured (the current default template) and a demo `(tabs)` group. **Leave the generated demo screens/components in place for now** — Task 7 replaces `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx` and deletes any other demo files under `app/` and `components/` the template scaffolded (explore.tsx, demo components, etc.) that aren't in this plan's file list. Don't hand-delete them in this task — leaves the project in a bootable state for every intermediate task's verification.

- [ ] **Step 2: `app.json` — name, scheme, plugins**

Edit the generated `mobile/app.json`'s `expo` object (keep every CLI-generated key you don't see below — icon/splash/asset paths, `newArchEnabled`, etc. — only change/add these):

```jsonc
{
  "expo": {
    "name": "Fridge AI",
    "slug": "fridge-ai-mobile",
    "scheme": "fridgeai",
    "plugins": ["expo-router", "expo-secure-store"]
  }
}
```

`scheme: "fridgeai"` is load-bearing — Task 5's `@better-auth/expo` OAuth deep-link flow depends on it exactly matching the value passed to `expoClient({ scheme: ... })`.

- [ ] **Step 3: `package.json` — name, scripts**

Edit `mobile/package.json`: set `"name": "fridge-ai-mobile"`, and merge these into `"scripts"` (keep the CLI-generated `start`/`android`/`ios`/`web` entries):

```json
{
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "boundaries": "depcruise --config .dependency-cruiser.cjs src"
  }
}
```

- [ ] **Step 4: ESLint — `npx expo lint`**

From `mobile/`:

```bash
npx expo lint
```

This installs `eslint-config-expo` and generates a working flat-config `eslint.config.js`. **Deviation from `docs/phase-0/01-arborescence.md`'s aspiration of one shared root `eslint.config.mjs` extended by both packages:** that root config doesn't exist yet (only `backend/eslint.config.js` does, standalone, from an earlier CI fix) — unifying them is a real refactor with real risk to `backend`'s already-green CI, out of scope for this phase. `mobile/eslint.config.js` stays independent, using Expo's own recommended config. Flagged here, not silently diverged from the doc.

- [ ] **Step 5: `mobile/.dependency-cruiser.cjs`**

```js
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  extends: '../.dependency-cruiser.cjs',
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: {
      path: 'node_modules|\\.test\\.',
    },
  },
}
```

Same shape as `backend/.dependency-cruiser.cjs`, with one deliberate difference: the `\\.test\\.` exclusion. Unlike `backend/`, whose tests live entirely outside `src/` (`backend/tests/`), this phase colocates `*.test.ts(x)` files next to the source they cover (the prevailing React Native / testing-library convention, and `docs/phase-0/01-arborescence.md` doesn't specify a separate mobile test tree). Without this exclusion, Task 6/7's `application`/`presentation`-layer test files — which import `FakeFridgeConnector` from `infrastructure` to drive the fake connector through real hooks/components — would trip `application-only-depends-on-domain` / the presentation equivalent. Test files reaching into infrastructure to inject a fake is normal and desired; production code doing the same is exactly what the rule exists to catch, and stays caught.

- [ ] **Step 6: `mobile/.env.example`**

```
EXPO_PUBLIC_CONNECTOR=http
EXPO_PUBLIC_API_URL=http://localhost:3333
```

- [ ] **Step 7: Verify it boots**

Run: `cd mobile && npx expo start --web --non-interactive` (or `npx tsc --noEmit` at minimum if a web/native runtime isn't available in this environment) — confirm no startup errors from the CLI-generated demo app before moving on. Stop the dev server once confirmed (Ctrl+C or kill the background process).

- [ ] **Step 8: Taskfile wiring**

Add to `Taskfile.yml` (alongside the existing backend tasks — add a `MOBILE` var next to the existing `BACKEND` one in `vars:`):

```yaml
vars:
  BACKEND: fridge-ai-backend
  MOBILE: fridge-ai-mobile
```

```yaml
  dev:mobile:
    desc: Run the Expo dev server.
    dir: mobile
    cmds:
      - pnpm run start

  lint:mobile:
    desc: Lint the mobile app.
    cmds:
      - pnpm --filter {{.MOBILE}} run lint

  typecheck:mobile:
    desc: Typecheck the mobile app.
    cmds:
      - pnpm --filter {{.MOBILE}} run typecheck

  test:mobile:
    desc: Run mobile tests (Jest).
    dir: mobile
    cmds:
      - pnpm run test

  boundaries:mobile:
    desc: Lint the mobile app's dependency boundaries.
    cmds:
      - pnpm --filter {{.MOBILE}} run boundaries
```

Extend the existing `check` task to also run these (append, don't replace the backend ones already there):

```yaml
  check:
    desc: The CI command — lint + typecheck + tests + boundary lint, both packages.
    cmds:
      - task: lint
      - task: typecheck
      - task: test
      - task: boundaries
      - task: lint:mobile
      - task: typecheck:mobile
      - task: test:mobile
      - task: boundaries:mobile
```

- [ ] **Step 9: CI — new `mobile-check` job**

Add to `.github/workflows/ci.yml`, alongside the existing `check`/`build` jobs (no Postgres service needed — mobile has no DB):

```yaml
  mobile-check:
    name: Mobile — lint, typecheck, tests, boundaries
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

      - name: Run checks (lint + typecheck + tests + boundary lint)
        run: task lint:mobile typecheck:mobile test:mobile boundaries:mobile
```

- [ ] **Step 10: Run the new Taskfile commands, commit**

Run: `task lint:mobile && task typecheck:mobile && task test:mobile && task boundaries:mobile` — all should pass against the CLI-generated demo app (boundaries may report 0 modules cruised if `mobile/src/` doesn't exist yet from the template; that's fine, Task 4 creates it).

```bash
git add mobile Taskfile.yml .github/workflows/ci.yml
git commit -m "chore(mobile): scaffold Expo app, monorepo/CI/Taskfile wiring"
```

---

### Task 2: Testing infra — `jest-expo` + `@testing-library/react-native`

**Files:**
- Modify: `mobile/package.json` (devDependencies, `jest` config)
- Create: `mobile/jest.setup.ts`

**Interfaces:**
- Produces: `mobile/package.json`'s `test` script (already wired in Task 1) running a real jest-expo + testing-library suite — every later task's tests depend on this working.

- [ ] **Step 1: Install**

From `mobile/`:

```bash
npx expo install jest-expo jest
pnpm add -D @testing-library/react-native @types/jest
```

- [ ] **Step 2: Jest config in `package.json`**

Add to `mobile/package.json` (top-level `"jest"` key):

```json
{
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEach": [],
    "setupFiles": ["./jest.setup.ts"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ]
  }
}
```

`transformIgnorePatterns` is `jest-expo`'s standard pattern for transforming RN/Expo's own ESM packages — copy exactly, don't simplify it (a narrower pattern breaks on the first RN-internal package that needs transforming).

- [ ] **Step 3: `mobile/jest.setup.ts`**

```ts
import '@testing-library/react-native/extend-expect'
```

- [ ] **Step 4: Write and run a throwaway smoke test to verify the setup**

Create a temporary `mobile/src/__smoke__.test.ts`:

```ts
import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

test('testing-library renders and asserts', () => {
  render(<Text>hello</Text>)
  expect(screen.getByText('hello')).toBeTruthy()
})
```

Run: `cd mobile && pnpm run test`
Expected: PASS, 1 test.

Delete `mobile/src/__smoke__.test.ts` once confirmed — it was only there to prove the harness works; Task 4 onward adds the real tests.

- [ ] **Step 5: Commit**

```bash
git add mobile/package.json mobile/jest.setup.ts mobile/pnpm-lock.yaml
git commit -m "test(mobile): jest-expo + @testing-library/react-native setup"
```

---

### Task 3: Tamagui + theming

**Files:**
- Create: `mobile/tamagui.config.ts`
- Create: `mobile/src/presentation/shared/theme-provider.tsx`
- Modify: `mobile/babel.config.js`, `mobile/metro.config.js`
- Modify: `mobile/package.json` (dependencies)

**Interfaces:**
- Produces: `ThemeProvider` component (`src/presentation/shared/theme-provider.tsx`) — wraps the app in `app/_layout.tsx` (Task 7).

- [ ] **Step 1: Install**

From `mobile/`:

```bash
pnpm add tamagui @tamagui/config @tamagui/babel-plugin @tamagui/metro-plugin
npx expo install expo-font
```

- [ ] **Step 2: `mobile/tamagui.config.ts`**

```ts
import { defaultConfig } from '@tamagui/config/v5'
import { createTamagui } from 'tamagui'

export const tamaguiConfig = createTamagui(defaultConfig)
export default tamaguiConfig
export type Conf = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}
```

- [ ] **Step 3: `mobile/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: ['@tamagui/babel-plugin'],
  }
}
```

(This replaces the CLI-generated default `babel.config.js`, which is just `{ presets: ['babel-preset-expo'] }` — add the Tamagui plugin to it rather than starting from scratch.)

- [ ] **Step 4: `mobile/metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config')
const { withTamagui } = require('@tamagui/metro-plugin')

const config = getDefaultConfig(__dirname)

module.exports = withTamagui(config, {
  components: ['tamagui'],
  config: './tamagui.config.ts',
})
```

- [ ] **Step 5: `mobile/src/presentation/shared/theme-provider.tsx`**

```tsx
import { useColorScheme } from 'react-native'
import { TamaguiProvider } from 'tamagui'
import type { ReactNode } from 'react'
import { tamaguiConfig } from '../../../tamagui.config'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme()
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme ?? 'light'}>
      {children}
    </TamaguiProvider>
  )
}
```

- [ ] **Step 6: Verify it boots, typecheck, commit**

Run: `cd mobile && npx tsc --noEmit && npx expo start --web --non-interactive` (confirm no Tamagui/Metro errors, stop once confirmed).

```bash
git add mobile/tamagui.config.ts mobile/src/presentation/shared/theme-provider.tsx \
  mobile/babel.config.js mobile/metro.config.js mobile/package.json mobile/pnpm-lock.yaml
git commit -m "feat(mobile): Tamagui setup (config, babel/metro plugins, ThemeProvider)"
```

---

### Task 4: Domain layer

**Files:**
- Create: `mobile/src/domain/shared/result.ts`
- Create: `mobile/src/domain/shared/api-error.ts`
- Create: `mobile/src/domain/identity/user.ts`
- Create: `mobile/src/domain/identity/session.ts`
- Create: `mobile/src/domain/identity/auth-method.ts`
- Create: `mobile/src/domain/interfaces/fridge-connector.ts`
- Test: `mobile/src/domain/shared/result.test.ts`

**Interfaces:**
- Produces: `Result<T, E>` (`{ ok: true; value: T } | { ok: false; error: E }`, plus `Result.ok`/`Result.err` helpers — same shape as the backend's, deliberately, so JSON round-tripping the two sides' mental model stays consistent), `ApiError { type: string; message: string; details?: unknown }`, `User`, `Session { user: User }`, `AuthMethod { id: 'password' | 'pocketid'; enabled: boolean; label: string }`, `FridgeConnector` interface — consumed by every task from here on.

- [ ] **Step 1: `mobile/src/domain/shared/result.ts`**

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export const Result = {
  ok<T>(value: T): Result<T, never> {
    return { ok: true, value }
  },
  err<E>(error: E): Result<never, E> {
    return { ok: false, error }
  },
}
```

- [ ] **Step 2: `mobile/src/domain/shared/api-error.ts`**

```ts
/** Structurally identical to the `error` field of the backend's error envelope (`error-serializer.ts`) — no re-mapping on this side. */
export interface ApiError {
  type: string
  message: string
  details?: unknown
}
```

- [ ] **Step 3: `mobile/src/domain/identity/user.ts`, `session.ts`, `auth-method.ts`**

```ts
// user.ts
export interface User {
  id: string
  email: string
  name: string
  image: string | null
}
```

```ts
// session.ts
import type { User } from './user.js'

export interface Session {
  user: User
}
```

```ts
// auth-method.ts
export interface AuthMethod {
  id: 'password' | 'pocketid'
  enabled: boolean
  label: string
}
```

- [ ] **Step 4: `mobile/src/domain/interfaces/fridge-connector.ts`**

```ts
import type { Result } from '../shared/result.js'
import type { ApiError } from '../shared/api-error.js'
import type { Session } from '../identity/session.js'
import type { AuthMethod } from '../identity/auth-method.js'

/**
 * The app's one abstraction boundary over the backend. Extended by one
 * method group per bounded context, one phase at a time — never a
 * placeholder method for a context this phase doesn't build.
 */
export interface FridgeConnector {
  getSession(): Promise<Session | null>
  getAuthMethods(): Promise<AuthMethod[]>
  signInEmail(email: string, password: string): Promise<Result<Session, ApiError>>
  signUpEmail(email: string, password: string, name: string): Promise<Result<Session, ApiError>>
  signInSocial(provider: 'pocketid'): Promise<Result<Session, ApiError>>
  signOut(): Promise<void>
}
```

- [ ] **Step 5: Write and run the unit test**

`mobile/src/domain/shared/result.test.ts`:

```ts
import { Result } from './result.js'

test('Result.ok() produces an ok result carrying the value', () => {
  const result = Result.ok(42)
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value).toBe(42)
})

test('Result.err() produces an err result carrying the error', () => {
  const result = Result.err('boom')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error).toBe('boom')
})
```

Run: `cd mobile && pnpm run test`
Expected: PASS.

- [ ] **Step 6: Typecheck, boundaries, commit**

Run: `cd mobile && npx tsc --noEmit && pnpm run boundaries` — boundaries must show 0 violations (this is the first content under `src/domain`, the zero-dependency rule now has something real to check).

```bash
git add mobile/src/domain
git commit -m "feat(mobile): domain layer (Result, ApiError, Session/User/AuthMethod, FridgeConnector)"
```

---

### Task 5: better-auth wiring (backend + mobile), `HttpFridgeConnector`, `FakeFridgeConnector`

**Files:**
- Modify: `backend/src/infrastructure/auth/better-auth/instance.ts`
- Modify: `backend/.env.example` (document the mobile scheme in `CORS_ORIGIN`)
- Create: `mobile/src/infrastructure/auth/auth-client.ts`
- Create: `mobile/src/infrastructure/http/http-client.ts`
- Create: `mobile/src/infrastructure/http/http-fridge-connector.ts`
- Create: `mobile/src/infrastructure/fake/fixtures/session.fixture.ts`
- Create: `mobile/src/infrastructure/fake/fake-fridge-connector.ts`
- Create: `mobile/providers/create-connector.ts`
- Test: `mobile/src/infrastructure/fake/fake-fridge-connector.test.ts`
- Test: `backend/tests/functional/identity/expo-plugin.spec.ts`

**Interfaces:**
- Consumes: `FridgeConnector`/`Result`/`ApiError`/`Session`/`AuthMethod` (Task 4).
- Produces: `HttpFridgeConnector`, `FakeFridgeConnector` (both implement `FridgeConnector`), `createConnector(): FridgeConnector` (reads `EXPO_PUBLIC_CONNECTOR`) — consumed by Task 6/7's screens via `ConnectorProvider`.

- [ ] **Step 1: Backend — add the `expo()` plugin**

In `backend/src/infrastructure/auth/better-auth/instance.ts`, add the import:

```ts
import { expo } from '@better-auth/expo'
```

and add `expo()` to the `plugins` array (it's currently `pocketIdConfigured ? [genericOAuth(...)] : []` — change to always include `expo()` regardless of PocketID config, since email/password auth needs it too):

```ts
  plugins: [
    expo(),
    ...(pocketIdConfigured
      ? [
          genericOAuth({
            config: [
              {
                providerId: 'pocketid',
                clientId: pocketIdClientId,
                clientSecret: pocketIdClientSecret,
                discoveryUrl: `${pocketIdIssuerUrl}/.well-known/openid-configuration`,
                scopes: ['openid', 'profile', 'email'],
              },
            ],
          }),
        ]
      : []),
  ],
```

Install the package: `cd backend && pnpm add @better-auth/expo`.

- [ ] **Step 2: Backend — document the mobile scheme in `CORS_ORIGIN`**

In `backend/.env.example`, find the `CORS_ORIGIN` line and update its comment (the variable itself stays comma-separated, no code change — just documentation of what mobile needs added when it's actually deployed):

```
# Frontend/app origin(s) the client calls the API from (better-auth trustedOrigins).
# Comma-separated. Mobile dev: add "exp://" ; mobile prod: add "fridgeai://".
CORS_ORIGIN=http://localhost:8081
```

- [ ] **Step 3: Backend — functional test that `expo()` didn't break existing auth**

`backend/tests/functional/identity/expo-plugin.spec.ts`:

```ts
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

test.group('identity: expo() plugin does not break email/password auth', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
  })
  group.each.teardown(() => db.rollbackGlobalTransaction())

  test('sign-up still returns a session cookie', async ({ client }) => {
    const response = await client
      .post('/api/auth/sign-up/email')
      .json({ email: 'expo-plugin-check@example.com', password: 'correct-horse-battery-staple', name: 'Test' })
    response.assertStatus(200)
    const cookie = response.headers()['set-cookie']
    if (!cookie) throw new Error('set-cookie header missing')
  })
})
```

Run: `cd backend && node ace test functional` — confirm this new test AND the full existing suite still pass (the `expo()` plugin must not regress email/password auth).

- [ ] **Step 4: Mobile — install auth dependencies**

From `mobile/`:

```bash
pnpm add better-auth @better-auth/expo
npx expo install expo-secure-store expo-linking expo-web-browser expo-constants expo-network
```

- [ ] **Step 5: `mobile/src/infrastructure/auth/auth-client.ts`**

```ts
import { createAuthClient } from 'better-auth/react'
import { expoClient } from '@better-auth/expo/client'
import * as SecureStore from 'expo-secure-store'

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  plugins: [
    expoClient({
      scheme: 'fridgeai',
      storage: SecureStore,
      storagePrefix: 'fridgeai',
    }),
  ],
})
```

- [ ] **Step 6: `mobile/src/infrastructure/http/http-client.ts`**

For the handful of custom (non-better-auth) backend endpoints this phase calls — currently just `GET /api/auth/methods`.

```ts
import { Result } from '../../domain/shared/result.js'
import type { ApiError } from '../../domain/shared/api-error.js'

const API_URL = process.env.EXPO_PUBLIC_API_URL as string

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<Result<T, ApiError>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
    const body = await response.json()
    if (!response.ok) return Result.err(body.error as ApiError)
    return Result.ok(body as T)
  } catch {
    return Result.err({ type: 'network_error', message: 'Impossible de contacter le serveur.' })
  }
}
```

- [ ] **Step 7: `mobile/src/infrastructure/http/http-fridge-connector.ts`**

```ts
import { authClient } from '../auth/auth-client.js'
import { apiFetch } from './http-client.js'
import { Result } from '../../domain/shared/result.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'
import type { Session } from '../../domain/identity/session.js'
import type { AuthMethod } from '../../domain/identity/auth-method.js'
import type { ApiError } from '../../domain/shared/api-error.js'

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

export class HttpFridgeConnector implements FridgeConnector {
  async getSession(): Promise<Session | null> {
    const { data } = await authClient.getSession()
    return toSession(data)
  }

  async getAuthMethods(): Promise<AuthMethod[]> {
    const result = await apiFetch<{ methods: AuthMethod[] }>('/api/auth/methods')
    return result.ok ? result.value.methods : []
  }

  async signInEmail(email: string, password: string): Promise<Result<Session, ApiError>> {
    const { error } = await authClient.signIn.email({ email, password })
    if (error) {
      return Result.err({ type: error.code ?? 'sign_in_failed', message: error.message ?? 'Connexion impossible.' })
    }
    const session = await this.getSession()
    if (!session) return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
    return Result.ok(session)
  }

  async signUpEmail(email: string, password: string, name: string): Promise<Result<Session, ApiError>> {
    const { error } = await authClient.signUp.email({ email, password, name })
    if (error) {
      return Result.err({ type: error.code ?? 'sign_up_failed', message: error.message ?? 'Inscription impossible.' })
    }
    const session = await this.getSession()
    if (!session) return Result.err({ type: 'sign_up_failed', message: 'Inscription impossible.' })
    return Result.ok(session)
  }

  async signInSocial(provider: 'pocketid'): Promise<Result<Session, ApiError>> {
    const { error } = await authClient.signIn.social({ provider, callbackURL: '/(tabs)' })
    if (error) {
      return Result.err({ type: error.code ?? 'sign_in_failed', message: error.message ?? 'Connexion impossible.' })
    }
    const session = await this.getSession()
    if (!session) return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
    return Result.ok(session)
  }

  async signOut(): Promise<void> {
    await authClient.signOut()
  }
}
```

- [ ] **Step 8: `mobile/src/infrastructure/fake/fixtures/session.fixture.ts`**

```ts
import type { Session } from '../../../domain/identity/session.js'

export const fakeSession: Session = {
  user: { id: 'fake-user-1', email: 'demo@example.com', name: 'Demo User', image: null },
}
```

- [ ] **Step 9: `mobile/src/infrastructure/fake/fake-fridge-connector.ts`**

```ts
import { Result } from '../../domain/shared/result.js'
import { fakeSession } from './fixtures/session.fixture.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'
import type { Session } from '../../domain/identity/session.js'
import type { AuthMethod } from '../../domain/identity/auth-method.js'
import type { ApiError } from '../../domain/shared/api-error.js'

/** In-memory only, resets on every reload — UI iteration without a running backend. */
export class FakeFridgeConnector implements FridgeConnector {
  private session: Session | null = null

  async getSession(): Promise<Session | null> {
    return this.session
  }

  async getAuthMethods(): Promise<AuthMethod[]> {
    return [
      { id: 'password', enabled: true, label: 'Email et mot de passe' },
      { id: 'pocketid', enabled: true, label: 'PocketID' },
    ]
  }

  async signInEmail(email: string, password: string): Promise<Result<Session, ApiError>> {
    if (!password) {
      return Result.err({ type: 'invalid_credentials', message: 'Email ou mot de passe invalide.' })
    }
    this.session = { user: { ...fakeSession.user, email } }
    return Result.ok(this.session)
  }

  async signUpEmail(email: string, _password: string, name: string): Promise<Result<Session, ApiError>> {
    this.session = { user: { ...fakeSession.user, email, name } }
    return Result.ok(this.session)
  }

  async signInSocial(): Promise<Result<Session, ApiError>> {
    this.session = fakeSession
    return Result.ok(this.session)
  }

  async signOut(): Promise<void> {
    this.session = null
  }
}
```

- [ ] **Step 10: Write and run the fake connector's unit test**

`mobile/src/infrastructure/fake/fake-fridge-connector.test.ts`:

```ts
import { FakeFridgeConnector } from './fake-fridge-connector.js'

test('getSession() starts null, sign-in populates it, sign-out clears it', async () => {
  const connector = new FakeFridgeConnector()
  expect(await connector.getSession()).toBeNull()

  const signIn = await connector.signInEmail('a@b.com', 'password')
  expect(signIn.ok).toBe(true)
  expect(await connector.getSession()).not.toBeNull()

  await connector.signOut()
  expect(await connector.getSession()).toBeNull()
})

test('signInEmail() rejects an empty password', async () => {
  const connector = new FakeFridgeConnector()
  const result = await connector.signInEmail('a@b.com', '')
  expect(result.ok).toBe(false)
})

test('getAuthMethods() returns both methods enabled', async () => {
  const connector = new FakeFridgeConnector()
  const methods = await connector.getAuthMethods()
  expect(methods).toHaveLength(2)
  expect(methods.every((m) => m.enabled)).toBe(true)
})
```

Run: `cd mobile && pnpm run test`
Expected: PASS.

- [ ] **Step 11: `mobile/providers/create-connector.ts`**

```ts
import { HttpFridgeConnector } from '../src/infrastructure/http/http-fridge-connector.js'
import { FakeFridgeConnector } from '../src/infrastructure/fake/fake-fridge-connector.js'
import type { FridgeConnector } from '../src/domain/interfaces/fridge-connector.js'

export function createConnector(): FridgeConnector {
  return process.env.EXPO_PUBLIC_CONNECTOR === 'fake' ? new FakeFridgeConnector() : new HttpFridgeConnector()
}
```

- [ ] **Step 12: Typecheck, boundaries, full backend check, commit**

Run: `cd mobile && npx tsc --noEmit && pnpm run boundaries` (boundaries must stay clean — `infrastructure` depends on `domain`, never `presentation`) and `cd backend && node ace lint && pnpm exec tsc --noEmit && node ace test` (confirm the `expo()` addition didn't regress anything backend-side).

```bash
git add backend/src/infrastructure/auth/better-auth/instance.ts backend/.env.example \
  backend/package.json backend/pnpm-lock.yaml backend/tests/functional/identity/expo-plugin.spec.ts \
  mobile/src/infrastructure mobile/providers mobile/package.json mobile/pnpm-lock.yaml
git commit -m "feat(mobile): better-auth wiring — expo() backend plugin, HttpFridgeConnector, FakeFridgeConnector"
```

---

### Task 6: TanStack Query plumbing + identity queries/mutations

**Files:**
- Create: `mobile/src/application/shared/connector-context.tsx`
- Create: `mobile/src/application/shared/use-domain-query.ts`
- Create: `mobile/src/application/shared/use-domain-mutation.ts`
- Create: `mobile/src/application/shared/define-query.ts`
- Create: `mobile/src/application/shared/define-mutation.ts`
- Create: `mobile/src/application/identity/session.query.ts`
- Create: `mobile/src/application/identity/auth-methods.query.ts`
- Create: `mobile/src/application/identity/sign-in.mutation.ts`
- Create: `mobile/src/application/identity/sign-up.mutation.ts`
- Create: `mobile/src/application/identity/sign-out.mutation.ts`
- Test: `mobile/src/application/identity/session.query.test.tsx`

**Interfaces:**
- Consumes: `FridgeConnector` (Task 4), `FakeFridgeConnector` (Task 5, used by the test).
- Produces: `ConnectorProvider`/`useConnector()`, `useSessionQuery`, `useAuthMethodsQuery`, `useSignInEmailMutation`, `useSignInSocialMutation`, `useSignUpMutation`, `useSignOutMutation` — consumed by Task 7's screens.

- [ ] **Step 1: Install TanStack Query**

From `mobile/`:

```bash
pnpm add @tanstack/react-query
```

- [ ] **Step 2: `mobile/src/application/shared/connector-context.tsx`**

```tsx
import { createContext, useContext, type ReactNode } from 'react'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'

const ConnectorContext = createContext<FridgeConnector | null>(null)

export function ConnectorProvider({
  connector,
  children,
}: {
  connector: FridgeConnector
  children: ReactNode
}) {
  return <ConnectorContext.Provider value={connector}>{children}</ConnectorContext.Provider>
}

export function useConnector(): FridgeConnector {
  const connector = useContext(ConnectorContext)
  if (!connector) throw new Error('useConnector() called outside <ConnectorProvider>')
  return connector
}
```

- [ ] **Step 3: `use-domain-query.ts` / `use-domain-mutation.ts` — the raw primitives**

```ts
// use-domain-query.ts
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { useConnector } from './connector-context.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'

export function useDomainQuery<TData>(
  queryKey: unknown[],
  queryFn: (connector: FridgeConnector) => Promise<TData>,
  options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>,
): UseQueryResult<TData> {
  const connector = useConnector()
  return useQuery({ queryKey, queryFn: () => queryFn(connector), ...options })
}
```

```ts
// use-domain-mutation.ts
import { useMutation } from '@tanstack/react-query'
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query'
import { useConnector } from './connector-context.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'

export function useDomainMutation<TVariables, TData>(
  mutationFn: (connector: FridgeConnector, variables: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>,
): UseMutationResult<TData, Error, TVariables> {
  const connector = useConnector()
  return useMutation({ mutationFn: (variables) => mutationFn(connector, variables), ...options })
}
```

- [ ] **Step 4: `define-query.ts` / `define-mutation.ts` — factories built on the primitives**

Every `*.query.ts`/`*.mutation.ts` file uses these to produce a named, reusable hook instead of calling `useDomainQuery`/`useDomainMutation` directly at every call site.

```ts
// define-query.ts
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { useDomainQuery } from './use-domain-query.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'

export function defineQuery<TData>(
  queryKey: unknown[],
  queryFn: (connector: FridgeConnector) => Promise<TData>,
) {
  return function useThisQuery(
    options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>,
  ): UseQueryResult<TData> {
    return useDomainQuery(queryKey, queryFn, options)
  }
}
```

```ts
// define-mutation.ts
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query'
import { useDomainMutation } from './use-domain-mutation.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'

export function defineMutation<TVariables, TData>(
  mutationFn: (connector: FridgeConnector, variables: TVariables) => Promise<TData>,
) {
  return function useThisMutation(
    options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>,
  ): UseMutationResult<TData, Error, TVariables> {
    return useDomainMutation(mutationFn, options)
  }
}
```

- [ ] **Step 5: Identity queries and mutations**

```ts
// session.query.ts
import { defineQuery } from '../shared/define-query.js'

export const useSessionQuery = defineQuery(['session'], (connector) => connector.getSession())
```

```ts
// auth-methods.query.ts
import { defineQuery } from '../shared/define-query.js'

export const useAuthMethodsQuery = defineQuery(['auth-methods'], (connector) =>
  connector.getAuthMethods(),
)
```

```ts
// sign-in.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'

export const useSignInEmailMutation = defineMutation(
  (connector, input: { email: string; password: string }) =>
    connector.signInEmail(input.email, input.password),
)

export const useSignInSocialMutation = defineMutation(
  (connector, input: { provider: 'pocketid' }) => connector.signInSocial(input.provider),
)
```

```ts
// sign-up.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'

export const useSignUpMutation = defineMutation(
  (connector, input: { email: string; password: string; name: string }) =>
    connector.signUpEmail(input.email, input.password, input.name),
)
```

```ts
// sign-out.mutation.ts
import { defineMutation } from '../shared/define-mutation.js'

export const useSignOutMutation = defineMutation((connector) => connector.signOut())
```

- [ ] **Step 6: Write and run a hook test with `FakeFridgeConnector`**

`mobile/src/application/identity/session.query.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { useSessionQuery } from './session.query.js'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  return (
    <QueryClientProvider client={queryClient}>
      <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
    </QueryClientProvider>
  )
}

test('useSessionQuery() resolves to null when the fake connector has no session', async () => {
  const { result } = renderHook(() => useSessionQuery(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toBeNull()
})
```

Run: `cd mobile && pnpm run test`
Expected: PASS.

- [ ] **Step 7: Typecheck, boundaries, commit**

Run: `cd mobile && npx tsc --noEmit && pnpm run boundaries` (`application` must depend only on `domain`, never `infrastructure`/`presentation` — the `.test.tsx` file importing `FakeFridgeConnector` is excluded from this check by Task 1's `mobile/.dependency-cruiser.cjs` `\\.test\\.` pattern).

```bash
git add mobile/src/application mobile/package.json mobile/pnpm-lock.yaml
git commit -m "feat(mobile): TanStack Query plumbing + identity queries/mutations"
```

---

### Task 7: Presentation + screens

**Files:**
- Create: `mobile/src/presentation/shared/error-state.tsx`
- Create: `mobile/src/presentation/identity/login-form.tsx`
- Create: `mobile/src/presentation/identity/signup-form.tsx`
- Create: `mobile/src/presentation/identity/auth-method-buttons.tsx`
- Modify: `mobile/app/_layout.tsx`
- Create: `mobile/app/(auth)/_layout.tsx`
- Create: `mobile/app/(auth)/sign-in.tsx`
- Create: `mobile/app/(auth)/sign-up.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`
- Delete: any other demo screens/components the Task 1 template scaffolded that aren't listed above (e.g. `app/(tabs)/explore.tsx`, template demo components under `components/`)
- Test: `mobile/src/presentation/identity/login-form.test.tsx`

**Interfaces:**
- Consumes: `useSessionQuery`, `useAuthMethodsQuery`, `useSignInEmailMutation`, `useSignInSocialMutation`, `useSignUpMutation`, `useSignOutMutation` (Task 6), `ThemeProvider` (Task 3), `ConnectorProvider`/`createConnector` (Tasks 5-6).

- [ ] **Step 1: `mobile/src/presentation/shared/error-state.tsx`**

```tsx
import { Text, YStack } from 'tamagui'

export function ErrorState({ message }: { message: string }) {
  return (
    <YStack padding="$4" alignItems="center">
      <Text color="$red10">{message}</Text>
    </YStack>
  )
}
```

- [ ] **Step 2: `mobile/src/presentation/identity/login-form.tsx`**

```tsx
import { useState } from 'react'
import { Button, Input, YStack } from 'tamagui'
import { useSignInEmailMutation } from '../../application/identity/sign-in.mutation.js'
import { ErrorState } from '../shared/error-state.js'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const signIn = useSignInEmailMutation()

  async function handleSubmit() {
    const result = await signIn.mutateAsync({ email, password })
    if (result.ok) onSuccess()
  }

  const error = signIn.data && !signIn.data.ok ? signIn.data.error.message : null

  return (
    <YStack gap="$3" padding="$4">
      <Input
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        testID="login-email"
      />
      <Input
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="login-password"
      />
      {error ? <ErrorState message={error} /> : null}
      <Button onPress={handleSubmit} disabled={signIn.isPending} testID="login-submit">
        {signIn.isPending ? 'Connexion...' : 'Se connecter'}
      </Button>
    </YStack>
  )
}
```

- [ ] **Step 3: `mobile/src/presentation/identity/signup-form.tsx`**

```tsx
import { useState } from 'react'
import { Button, Input, YStack } from 'tamagui'
import { useSignUpMutation } from '../../application/identity/sign-up.mutation.js'
import { ErrorState } from '../shared/error-state.js'

export function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const signUp = useSignUpMutation()

  async function handleSubmit() {
    const result = await signUp.mutateAsync({ email, password, name })
    if (result.ok) onSuccess()
  }

  const error = signUp.data && !signUp.data.ok ? signUp.data.error.message : null

  return (
    <YStack gap="$3" padding="$4">
      <Input placeholder="Nom" value={name} onChangeText={setName} testID="signup-name" />
      <Input
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        testID="signup-email"
      />
      <Input
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="signup-password"
      />
      {error ? <ErrorState message={error} /> : null}
      <Button onPress={handleSubmit} disabled={signUp.isPending} testID="signup-submit">
        {signUp.isPending ? 'Inscription...' : "S'inscrire"}
      </Button>
    </YStack>
  )
}
```

- [ ] **Step 4: `mobile/src/presentation/identity/auth-method-buttons.tsx`**

```tsx
import { Button, YStack } from 'tamagui'
import { useAuthMethodsQuery } from '../../application/identity/auth-methods.query.js'
import { useSignInSocialMutation } from '../../application/identity/sign-in.mutation.js'

export function AuthMethodButtons({ onSuccess }: { onSuccess: () => void }) {
  const authMethods = useAuthMethodsQuery()
  const signInSocial = useSignInSocialMutation()

  const pocketId = authMethods.data?.find((m) => m.id === 'pocketid' && m.enabled)
  if (!pocketId) return null

  async function handlePress() {
    const result = await signInSocial.mutateAsync({ provider: 'pocketid' })
    if (result.ok) onSuccess()
  }

  return (
    <YStack padding="$4">
      <Button onPress={handlePress} disabled={signInSocial.isPending} testID="signin-social-pocketid">
        {pocketId.label}
      </Button>
    </YStack>
  )
}
```

- [ ] **Step 5: `mobile/app/_layout.tsx`**

Replaces the Task 1 CLI-generated demo root layout entirely.

```tsx
import { Slot } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ThemeProvider } from '../src/presentation/shared/theme-provider.js'
import { ConnectorProvider } from '../src/application/shared/connector-context.js'
import { createConnector } from '../providers/create-connector.js'

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient())
  const [connector] = useState(() => createConnector())

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <Slot />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
```

- [ ] **Step 6: `mobile/app/(auth)/_layout.tsx`, `sign-in.tsx`, `sign-up.tsx`**

```tsx
// (auth)/_layout.tsx
import { Redirect, Stack } from 'expo-router'
import { useSessionQuery } from '../../src/application/identity/session.query.js'

export default function AuthLayout() {
  const session = useSessionQuery()

  if (session.isPending) return null
  if (session.data) return <Redirect href="/(tabs)" />

  return <Stack screenOptions={{ headerShown: false }} />
}
```

```tsx
// (auth)/sign-in.tsx
import { Link, router } from 'expo-router'
import { Text, YStack } from 'tamagui'
import { LoginForm } from '../../src/presentation/identity/login-form.js'
import { AuthMethodButtons } from '../../src/presentation/identity/auth-method-buttons.js'

export default function SignInScreen() {
  function handleSuccess() {
    router.replace('/(tabs)')
  }

  return (
    <YStack flex={1} justifyContent="center">
      <LoginForm onSuccess={handleSuccess} />
      <AuthMethodButtons onSuccess={handleSuccess} />
      <Link href="/(auth)/sign-up">
        <Text textAlign="center" padding="$4">
          Pas de compte ? S'inscrire
        </Text>
      </Link>
    </YStack>
  )
}
```

```tsx
// (auth)/sign-up.tsx
import { router } from 'expo-router'
import { YStack } from 'tamagui'
import { SignupForm } from '../../src/presentation/identity/signup-form.js'

export default function SignUpScreen() {
  function handleSuccess() {
    router.replace('/(tabs)')
  }

  return (
    <YStack flex={1} justifyContent="center">
      <SignupForm onSuccess={handleSuccess} />
    </YStack>
  )
}
```

- [ ] **Step 7: `mobile/app/(tabs)/_layout.tsx`, `index.tsx`**

Replaces the Task 1 CLI-generated demo tabs layout/screen entirely — also delete any other demo screens under `app/(tabs)/` the template scaffolded (e.g. `explore.tsx`) since this phase has exactly one tab.

```tsx
// (tabs)/_layout.tsx
import { Redirect, Tabs } from 'expo-router'
import { useSessionQuery } from '../../src/application/identity/session.query.js'

export default function TabsLayout() {
  const session = useSessionQuery()

  if (session.isPending) return null
  if (!session.data) return <Redirect href="/(auth)/sign-in" />

  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
    </Tabs>
  )
}
```

```tsx
// (tabs)/index.tsx
import { router } from 'expo-router'
import { Button, Text, YStack } from 'tamagui'
import { useSessionQuery } from '../../src/application/identity/session.query.js'
import { useSignOutMutation } from '../../src/application/identity/sign-out.mutation.js'

export default function HomeScreen() {
  const session = useSessionQuery()
  const signOut = useSignOutMutation()

  async function handleSignOut() {
    await signOut.mutateAsync(undefined)
    await session.refetch()
    router.replace('/(auth)/sign-in')
  }

  return (
    <YStack flex={1} justifyContent="center" alignItems="center" gap="$4">
      <Text>Connecté en tant que {session.data?.user.name}</Text>
      <Button onPress={handleSignOut} testID="sign-out">
        Se déconnecter
      </Button>
    </YStack>
  )
}
```

- [ ] **Step 8: Write and run a component test with `FakeFridgeConnector`**

`mobile/src/presentation/identity/login-form.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { LoginForm } from './login-form.js'

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  return render(
    <QueryClientProvider client={queryClient}>
      <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
    </QueryClientProvider>,
  )
}

test('submitting valid credentials calls onSuccess', async () => {
  const onSuccess = jest.fn()
  renderWithProviders(<LoginForm onSuccess={onSuccess} />)

  fireEvent.changeText(screen.getByTestId('login-email'), 'a@b.com')
  fireEvent.changeText(screen.getByTestId('login-password'), 'correct-horse-battery-staple')
  fireEvent.press(screen.getByTestId('login-submit'))

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
})

test('submitting an empty password shows an error, does not call onSuccess', async () => {
  const onSuccess = jest.fn()
  renderWithProviders(<LoginForm onSuccess={onSuccess} />)

  fireEvent.changeText(screen.getByTestId('login-email'), 'a@b.com')
  fireEvent.press(screen.getByTestId('login-submit'))

  await waitFor(() => expect(screen.getByText('Email ou mot de passe invalide.')).toBeTruthy())
  expect(onSuccess).not.toHaveBeenCalled()
})
```

Run: `cd mobile && pnpm run test`
Expected: PASS, full suite green.

- [ ] **Step 9: Manual smoke check with the fake connector**

Run: `cd mobile && EXPO_PUBLIC_CONNECTOR=fake npx expo start --web --non-interactive` — confirm the app boots to the sign-in screen (no session yet), and stop once confirmed. This is the fake-connector path proving the whole wiring (routing, theme, query, forms) works without a live backend.

- [ ] **Step 10: Full monorepo check, commit**

Run: `task check` from the repo root (now covers both `backend` and `mobile` per Task 1's Taskfile wiring) — must be fully green.

```bash
git add mobile/src/presentation mobile/app
git commit -m "feat(mobile): presentation + screens (sign-in, sign-up, session-gated tabs)"
```
