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
  // HOST is 0.0.0.0 so the server answers on the LAN, which makes APP_URL
  // unusable as an outward-facing address: better-auth hands its baseURL to
  // PocketID as the OAuth redirect_uri, and the phone has to reach it too.
  // NETWORK_URL is that same server under the machine's LAN IP.
  NETWORK_URL: Env.schema.string({ format: 'url', tld: false }),

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

  // AI provider (settings, cf. docs/adr/0007) — optional, EnvAiSettingsProvider
  // falls back to a hardcoded default if unset.
  AI_PROVIDER: Env.schema.enum.optional(['gemini', 'openai', 'ollama'] as const),
  GEMINI_API_KEY: Env.schema.string.optional(),
  OPENAI_API_KEY: Env.schema.string.optional(),
  OLLAMA_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  OLLAMA_VISION_MODEL: Env.schema.string.optional(),
  OLLAMA_TEXT_MODEL: Env.schema.string.optional(),

  // Root directory for locally-stored images (receipts, products) — cf. ADR-0009.
  STORAGE_ROOT: Env.schema.string.optional(),

  // Observability — cf. docs/adr/0011. `OTEL_ENABLED` and the OTEL_* exporter
  // variables are read straight from `process.env` by `instrumentation.ts`,
  // which runs before this file exists; they are declared here only so that
  // a typo surfaces at boot instead of as silent missing telemetry.
  OTEL_ENABLED: Env.schema.boolean.optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: Env.schema.string.optional({ format: 'url', tld: false }),
  APP_VERSION: Env.schema.string.optional(),
  DEPLOY_ENV: Env.schema.string.optional(),

  // Mobile telemetry relay (POST /api/telemetry/v1/*) — the app never talks
  // to the collector directly, cf. docs/adr/0011.
  TELEMETRY_INGEST_ENABLED: Env.schema.boolean.optional(),
  TELEMETRY_OTLP_ENDPOINT: Env.schema.string.optional({ format: 'url', tld: false }),
  TELEMETRY_MAX_BODY_BYTES: Env.schema.number.optional(),
  TELEMETRY_RATE_LIMIT_PER_MINUTE: Env.schema.number.optional(),
})
