import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The AI provider choice moves from instance-wide to per-household: on the
 * SaaS, two foyers on one instance must be able to pick differently (and one
 * of them to be paywalled while the other is not).
 *
 * The table held at most one row, written by a household owner, so the
 * backfill is exact: the row belongs to the foyer of whoever last changed it
 * (`updated_by`). A row whose author is gone (`updated_by` was SET NULL when
 * the user was deleted) carries no such link and is deleted — the foyer falls
 * back to the env default, which is what an unwritten row means anyway.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ai_provider_setting', (table) => {
      table
        .text('household_id')
        .nullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE ai_provider_setting AS s
        SET household_id = m.household_id
        FROM household_member AS m
        WHERE m.user_id = s.updated_by
      `)
      await db.rawQuery('DELETE FROM ai_provider_setting WHERE household_id IS NULL')
    })

    this.schema.alterTable('ai_provider_setting', (table) => {
      table.text('household_id').notNullable().alter()
      table.unique(['household_id'])
    })
  }

  async down() {
    this.schema.alterTable('ai_provider_setting', (table) => {
      table.dropUnique(['household_id'])
      table.dropColumn('household_id')
    })
  }
}
