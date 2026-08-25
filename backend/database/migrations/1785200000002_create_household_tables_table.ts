import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('household', (table) => {
      table.text('id').primary()
      table.text('name').notNullable()
      table.text('owner_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('invite_code').notNullable().unique()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.createTable('household_member', (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('role').notNullable().checkIn(['owner', 'member'])
      table.timestamp('joined_at', { useTz: true }).notNullable().defaultTo(this.now())
      // Invariant "un seul foyer par utilisateur" (docs/adr/0003) — applied
      // in the database, not just the aggregate.
      table.unique(['user_id'])
    })

    this.schema.alterTable('household_member', (table) => {
      table.index('household_id')
    })
  }

  async down() {
    this.schema.dropTable('household_member')
    this.schema.dropTable('household')
  }
}
