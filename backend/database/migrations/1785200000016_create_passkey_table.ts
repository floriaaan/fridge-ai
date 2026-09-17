import { BaseSchema } from '@adonisjs/lucid/schema'

/** Matches @better-auth/passkey's `schema.passkey` (cf. instance.ts's field mapping), snake_case like every other table here. */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('passkey', (table) => {
      table.text('id').primary()
      table.text('name').nullable()
      table.text('public_key').notNullable()
      table.text('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('credential_id').notNullable().index()
      table.integer('counter').notNullable()
      table.text('device_type').notNullable()
      table.boolean('backed_up').notNullable()
      table.text('transports').nullable()
      table.timestamp('created_at', { useTz: true }).nullable()
      table.text('aaguid').nullable()
    })
  }

  async down() {
    this.schema.dropTable('passkey')
  }
}
