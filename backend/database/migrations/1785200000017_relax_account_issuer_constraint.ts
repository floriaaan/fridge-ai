import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `account.issuer` (cf. `1785200000004_add_issuer_to_account_table`) was
 * required by better-auth 1.7.0–1.7.2's core schema. 1.7.3 dropped that
 * requirement — accounts go back to being identified by
 * `(provider_id, account_id)`, better-auth 1.6's behavior — so a NOT NULL
 * column it never writes now breaks every plain email/password sign-up.
 * Per better-auth's 1.7 upgrade guide: drop the constraint, don't bother
 * dropping the column itself (harmless, unused going forward).
 */
export default class extends BaseSchema {
  protected tableName = 'account'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['issuer', 'account_id'])
    })
    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE "${this.tableName}" ALTER COLUMN "issuer" DROP NOT NULL`)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE "${this.tableName}" ALTER COLUMN "issuer" SET NOT NULL`)
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['issuer', 'account_id'])
    })
  }
}
