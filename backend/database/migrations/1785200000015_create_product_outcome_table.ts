import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per product leaving the garde-manger — eaten or thrown away (ADR-0012).
 *
 * A log, not columns on `product`: the product row is usually deleted in the
 * same transaction, and a partial exit ("2 yaourts sur 6") is several facts
 * about one product. Everything a statistic needs is snapshotted here so no
 * read ever joins back to a row that no longer exists — which is also why
 * `product_id` carries no foreign key.
 *
 * Data-entry mistakes are not outcomes and never reach this table.
 */
export default class extends BaseSchema {
  protected tableName = 'product_outcome'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('product_id').notNullable()
      // The member may leave the foyer; what happened to the product stays.
      table.text('recorded_by').nullable().references('id').inTable('user').onDelete('SET NULL')
      table.text('recipe_id').nullable().references('id').inTable('recipe').onDelete('SET NULL')
      table.text('kind').notNullable().checkIn(['consumed', 'discarded'])
      table.text('discard_reason').nullable().checkIn(['expired', 'spoiled', 'disliked', 'other'])
      table.text('product_name').notNullable()
      table.text('category').notNullable()
      table.specificType('categories', 'text[]').nullable()
      table.text('location').notNullable().checkIn(['fridge', 'freezer', 'pantry'])
      table.integer('amount').notNullable()
      table.text('unit').notNullable()
      table.decimal('price', 10, 2).nullable()
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.timestamp('occurred_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.index(['household_id', 'occurred_at'])
      table.index('product_id')
    })

    this.defer(async (db) => {
      await db.rawQuery(
        `ALTER TABLE "product_outcome" ADD CONSTRAINT "product_outcome_amount_positive" CHECK ("amount" > 0)`,
      )
      await db.rawQuery(
        `ALTER TABLE "product_outcome" ADD CONSTRAINT "product_outcome_reason_only_when_discarded" CHECK ("discard_reason" IS NULL OR "kind" = 'discarded')`,
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
