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
