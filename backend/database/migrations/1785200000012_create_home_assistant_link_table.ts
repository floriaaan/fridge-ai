import { BaseSchema } from '@adonisjs/lucid/schema'

/** Cf. docs/adr/0013. One row per household — uniqueness enforced by the
 * repository's upsert (`updateOrCreate` keyed by household_id lookup, cf.
 * ai_provider_setting's own note), same convention as that singleton table. */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('home_assistant_link', (table) => {
      table.text('id').primary()
      table
        .text('household_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('household')
        .onDelete('CASCADE')
      table.text('instance_url').notNullable()
      table.text('encrypted_token').notNullable()
      table.text('todo_entity_id').nullable()
      table.text('todo_entity_name').nullable()
      table.text('direction').notNullable().defaultTo('two_way').checkIn(['push', 'pull', 'two_way'])
      table.boolean('enabled').notNullable().defaultTo(true)
      table.timestamp('last_sync_at', { useTz: true }).nullable()
      table.string('last_error', 500).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable('home_assistant_link')
  }
}
