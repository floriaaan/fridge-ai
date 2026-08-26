# fridge-ai mobile

Expo (SDK 57) app for fridge-ai, built with expo-router and TanStack Query.

## Setup

This app lives in a pnpm workspace — install from the repo root, not from `mobile/`:

```bash
pnpm install
# or
task setup
```

## Environment

Copy `mobile/.env.example` to `mobile/.env` and adjust as needed:

- `EXPO_PUBLIC_CONNECTOR` — `http` to talk to the real backend, or `fake` to use the in-memory fake connector (no backend required).
- `EXPO_PUBLIC_API_URL` — base URL of the backend API (used when `EXPO_PUBLIC_CONNECTOR=http`).

## Running

```bash
task dev:mobile
# or, from mobile/
pnpm run start
```

## Project layout

Code lives under `mobile/src`, layered as `domain/`, `application/`, `infrastructure/`, `presentation/`. `src/app/` is routing only (expo-router file-based routes) — it wires screens together but never imports `infrastructure/` directly; screens depend on `application/`/`presentation/` instead.

## Checks

From `mobile/`:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run boundaries
```

Or from the repo root: `task lint:mobile`, `task typecheck:mobile`, `task test:mobile`, `task boundaries:mobile` (or `task check` for the whole repo).
