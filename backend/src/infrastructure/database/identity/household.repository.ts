import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import HouseholdModel from './household.lucid.js'
import HouseholdMemberModel from './household_member.lucid.js'
import { toDomain } from './household.mapper.js'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { Household } from '#domain/identity/household.aggregate'
import type { InviteCode } from '#domain/identity/invite-code.vo'

export class LucidHouseholdRepository implements HouseholdRepository {
  async findById(id: string): Promise<Household | null> {
    const row = await HouseholdModel.query().where('id', id).preload('members').first()
    return row ? toDomain(row) : null
  }

  async findByUserId(userId: string): Promise<Household | null> {
    const member = await HouseholdMemberModel.query().where('user_id', userId).first()
    if (!member) return null
    return this.findById(member.householdId)
  }

  async findByInviteCode(code: InviteCode): Promise<Household | null> {
    const row = await HouseholdModel.query()
      .where('invite_code', code.value)
      .preload('members')
      .first()
    return row ? toDomain(row) : null
  }

  async save(household: Household): Promise<void> {
    await db.transaction(async (trx) => {
      await HouseholdModel.updateOrCreate(
        { id: household.id },
        {
          name: household.name,
          ownerId: household.ownerId,
          inviteCode: household.inviteCode.value,
        },
        { client: trx },
      )

      const existingRows = await HouseholdMemberModel.query({ client: trx }).where(
        'household_id',
        household.id,
      )
      const currentIds = new Set(household.members.map((m) => m.id))

      const removedIds = existingRows.filter((row) => !currentIds.has(row.id)).map((row) => row.id)
      if (removedIds.length > 0) {
        await HouseholdMemberModel.query({ client: trx }).whereIn('id', removedIds).delete()
      }

      for (const member of household.members) {
        await HouseholdMemberModel.updateOrCreate(
          { id: member.id },
          {
            householdId: member.householdId,
            userId: member.userId,
            role: member.role,
            joinedAt: DateTime.fromJSDate(member.joinedAt),
          },
          { client: trx },
        )
      }
    })
  }

  async delete(id: string): Promise<void> {
    await HouseholdModel.query().where('id', id).delete()
  }
}
