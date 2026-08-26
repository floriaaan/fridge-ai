import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class HouseholdMemberModel extends BaseModel {
  static table = 'household_member'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'household_id' })
  declare householdId: string

  @column({ columnName: 'user_id' })
  declare userId: string

  @column()
  declare role: 'owner' | 'member'

  @column.dateTime({ columnName: 'joined_at', autoCreate: true })
  declare joinedAt: DateTime
}
