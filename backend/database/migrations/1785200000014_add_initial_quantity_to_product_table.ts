import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The largest quantity a product is known to have had — what its `price` pays for.
 *
 * `price` on `product` is the receipt line total for the quantity bought. Once
 * a product can leave the garde-manger one unit at a time (ADR-0012), the value
 * of "2 yaourts jetés" is `price × 2 / initial_quantity`, and `quantity` alone
 * can no longer answer it: it has already gone down.
 *
 * Backfilled from `quantity`. Products already partly eaten before this
 * migration get an `initial_quantity` that is too small, so their partial
 * outcomes are overvalued — there is no history to rebuild it from.
 */
export default class extends BaseSchema {
  protected tableName = 'product'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('initial_quantity').nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`UPDATE "product" SET "initial_quantity" = "quantity"`)
      await db.rawQuery(`ALTER TABLE "product" ALTER COLUMN "initial_quantity" SET NOT NULL`)
      await db.rawQuery(
        `ALTER TABLE "product" ADD CONSTRAINT "product_initial_quantity_covers_quantity" CHECK ("initial_quantity" >= "quantity")`,
      )
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('initial_quantity')
    })
  }
}
