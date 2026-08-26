import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('receipt', (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('store_name').notNullable()
      table.timestamp('scanned_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.decimal('total_amount', 10, 2).notNullable()
      table.text('image_key').nullable()
      table.integer('items_count').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable('receipt', (table) => {
      table.index('household_id')
    })
  }

  async down() {
    this.schema.dropTable('receipt')
  }
}
