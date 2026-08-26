import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `create_identity_tables_table.ts`'s own docstring flagged this: "Re-verify
 * against `npx @better-auth/cli generate` once the library is configured
 * (Task 7)." Once wired up (Task 7), better-auth's actual core schema
 * (`@better-auth/core`'s `get-tables.ts`) turned out to require an `issuer`
 * field on `account` — required on every row, with a unique
 * `(issuer, account_id)` index — independent of whether the `genericOAuth`
 * plugin is enabled. The original migration predates this discovery. Added
 * as its own migration rather than editing the already-applied one.
 */
export default class extends BaseSchema {
  protected tableName = 'account'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('issuer').notNullable().defaultTo('credential')
      table.unique(['issuer', 'account_id'])
    })

    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE "${this.tableName}" ALTER COLUMN "issuer" DROP DEFAULT`)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['issuer', 'account_id'])
      table.dropColumn('issuer')
    })
  }
}
