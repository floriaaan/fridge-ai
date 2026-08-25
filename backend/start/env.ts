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
