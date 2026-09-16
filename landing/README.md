# garde-manger landing

Marketing site for Garde-manger, built with TanStack Start (SSR), TanStack Query and Tailwind v4. Visual rules come from [`mobile/DESIGN.md`](../mobile/DESIGN.md).

## Setup

Install from the repo root (pnpm workspace), then copy the env file:

```bash
pnpm install
cp landing/.env.example landing/.env
task dev:landing   # http://localhost:3000
```

## Environment

Inlined at build time (`VITE_*`): the visitor's browser does the fetching, so use public URLs.

- `VITE_CONNECTOR` — `fake` (in-memory, no network) or `http` (real backend + GitHub API).
- `VITE_API_URL` — backend serving `GET /api/public/stats`. Needs `PUBLIC_STATS_ENABLED=true` and this site's origin in the backend's `CORS_ORIGIN`.
- `VITE_GITHUB_REPO` — `owner/name`, for the star count and every repository link.

## Content

- Copy: `src/infrastructure/content/landing-content.fr.ts`, typed by `src/domain/content/landing-content.ts`.
- Screenshots: `public/screenshots/` (598×1300 JPEG).
- The self-hosting commands shown on the page mirror the root [README](../README.md#installation) — change both together.

## Layout

`src/` is layered as `domain/`, `application/` (query hooks), `infrastructure/` (`LandingConnector` with `http` and `fake` implementations, content) and `presentation/`. `routes/` only wires pages.

## Checks

```bash
task typecheck:landing
task test:landing
task boundaries:landing
```

## Docker

The `landing` service sits behind a Compose profile, so `docker compose up -d` skips it:

```bash
docker compose --profile landing up -d --build landing
```

Build args come from `LANDING_CONNECTOR`, `LANDING_API_URL`, `LANDING_GITHUB_REPO` and `LANDING_PORT` in the root `.env`.
