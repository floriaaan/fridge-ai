import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import HouseholdMemberModel from './household_member.lucid.js'

export default class HouseholdModel extends BaseModel {
  static table = 'household'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column({ columnName: 'owner_id' })
  declare ownerId: string

  @column({ columnName: 'invite_code' })
  declare inviteCode: string

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'updated_at', autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => HouseholdMemberModel, { foreignKey: 'householdId' })
  declare members: HasMany<typeof HouseholdMemberModel>
}
