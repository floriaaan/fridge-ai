import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('product', (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('receipt_id').nullable().references('id').inTable('receipt').onDelete('SET NULL')
      table.text('name').notNullable()
      table.integer('quantity').notNullable()
      table.text('unit').notNullable()
      table.text('location').notNullable().checkIn(['fridge', 'freezer', 'pantry'])
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.timestamp('opened_at', { useTz: true }).nullable()
      table.text('category').notNullable()
      table.text('openfoodfact_id').nullable()
      table.specificType('categories', 'text[]').nullable()
      table.decimal('price', 10, 2).nullable()
      table.text('image_key').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable('product', (table) => {
      table.index('household_id')
      table.index('expires_at')
      table.index('receipt_id')
    })
  }

  async down() {
    this.schema.dropTable('product')
  }
}
