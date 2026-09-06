import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per "j'ai cuisiné".
 *
 * The app recommended a dish to save a product and had no way to hear that it
 * worked, so it recommended the same dish for the same product the next
 * evening while the dashboard's overdue count climbed — the anti-gaspi loop
 * never closed, and nothing in the system could tell a foyer it had actually
 * prevented waste.
 *
 * A log, not a counter on `recipe`: "cuisinée 2 fois" and "par Camille, mardi"
 * are two questions, a counter answers neither on its own, and a shared
 * library wants to know *who*. `household_id` is carried denormalised so the
 * count can be read without joining back through the recipe.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('recipe_cook', (table) => {
      table.text('id').primary()
      table.text('recipe_id').notNullable().references('id').inTable('recipe').onDelete('CASCADE')
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      // The cook may leave the foyer; the fact that the dish was cooked stays.
      table.text('cooked_by').nullable().references('id').inTable('user').onDelete('SET NULL')
      table.integer('products_used').notNullable().defaultTo(0)
      table.timestamp('cooked_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable('recipe_cook', (table) => {
      table.index('recipe_id')
      table.index(['household_id', 'cooked_at'])
    })
  }

  async down() {
    this.schema.dropTable('recipe_cook')
  }
}
