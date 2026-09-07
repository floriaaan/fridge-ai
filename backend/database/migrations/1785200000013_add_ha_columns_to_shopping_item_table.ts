import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('shopping_item', (table) => {
      table.text('ha_uid').nullable()
      table.timestamp('ha_synced_at', { useTz: true }).nullable()
    })

    this.schema.alterTable('shopping_item', (table) => {
      table.index('ha_uid')
    })
  }

  async down() {
    this.schema.alterTable('shopping_item', (table) => {
      table.dropColumn('ha_uid')
      table.dropColumn('ha_synced_at')
    })
  }
}
