import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('recipe_ingredient', (table) => {
      table.text('id').primary()
      table.text('recipe_id').notNullable().references('id').inTable('recipe').onDelete('CASCADE')
      table.text('product_id').nullable().references('id').inTable('product').onDelete('SET NULL')
      table.text('label').notNullable()
      table.integer('quantity').nullable()
      table.text('unit').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable('recipe_ingredient', (table) => {
      table.index('recipe_id')
      table.index('product_id')
    })
  }

  async down() {
    this.schema.dropTable('recipe_ingredient')
  }
}
