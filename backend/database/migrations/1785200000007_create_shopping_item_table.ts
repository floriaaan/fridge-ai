import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('shopping_item', (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('name').notNullable()
      table.integer('quantity').notNullable()
      table.text('unit').notNullable()
      table.boolean('checked').notNullable().defaultTo(false)
      table.text('source').notNullable().checkIn(['manual', 'auto_expired', 'recipe'])
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable('shopping_item', (table) => {
      table.index('household_id')
    })
  }

  async down() {
    this.schema.dropTable('shopping_item')
  }
}
