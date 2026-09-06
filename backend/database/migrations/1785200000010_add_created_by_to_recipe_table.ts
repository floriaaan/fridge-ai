import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Who wrote this recipe into the foyer's library.
 *
 * The whole product is scoped to a household rather than a person, and the
 * recipe library was the one shared artefact that carried no trace of who put
 * it there — four people generating into one list, anonymously.
 *
 * `SET NULL`, not `CASCADE`: a member leaving the foyer must not take the
 * recipes with them. The row survives, and the screen says "un ancien membre".
 * Nullable for the same reason, and because every row that already exists
 * predates the column.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('recipe', (table) => {
      table.text('created_by').nullable().references('id').inTable('user').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('recipe', (table) => {
      table.dropColumn('created_by')
    })
  }
}
