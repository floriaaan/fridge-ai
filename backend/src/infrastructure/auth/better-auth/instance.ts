import { betterAuth } from 'better-auth'
import { genericOAuth } from 'better-auth/plugins'
import { expo } from '@better-auth/expo'
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
                // Without this, better-auth defaults to `scopes: []` — an
                // empty `scope=` param that PocketID rejects outright with
                // access_denied rather than a scope-specific error.
                scopes: ['openid', 'profile', 'email'],
              },
            ],
          }),
        ]
      : []),
  ],
})

export type Auth = typeof auth
