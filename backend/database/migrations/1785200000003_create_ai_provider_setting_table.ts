import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Cf. docs/adr/0007. Not used by any code until the `settings` module lands
 * in a later phase — created now so migration numbering stays append-only.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('ai_provider_setting', (table) => {
      table.text('id').primary()
      table.text('active_provider').notNullable().checkIn(['gemini', 'openai', 'ollama'])
      table.text('updated_by').nullable().references('id').inTable('user').onDelete('SET NULL')
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable('ai_provider_setting')
  }
}
