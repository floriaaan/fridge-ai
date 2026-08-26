import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('recipe', (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('title').notNullable()
      table.text('description').nullable()
      table.text('source').notNullable().checkIn(['ai', 'user'])
      table.text('instructions').notNullable()
      table.integer('preparation_time').nullable()
      table.specificType('tags', 'text[]').notNullable().defaultTo('{}')
      table.text('image_key').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.alterTable('recipe', (table) => {
      table.index('household_id')
    })
  }

  async down() {
    this.schema.dropTable('recipe')
  }
}
