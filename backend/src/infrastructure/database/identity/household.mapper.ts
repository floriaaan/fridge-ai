import { Household } from '#domain/identity/household.aggregate'
import { HouseholdMember } from '#domain/identity/household-member.entity'
import { InviteCode } from '#domain/identity/invite-code.vo'
import type HouseholdModel from './household.lucid.js'

export function toDomain(row: HouseholdModel): Household {
  const inviteCode = InviteCode.create(row.inviteCode)
  if (!inviteCode.ok) {
    throw new Error(`Corrupted household row ${row.id}: ${inviteCode.error.message}`)
  }

  const members = row.members.map((m) =>
    HouseholdMember.create(m.id, {
      userId: m.userId,
      householdId: m.householdId,
      role: m.role,
      joinedAt: m.joinedAt.toJSDate(),
    }),
  )

  return Household.reconstruct(row.id, {
    name: row.name,
    ownerId: row.ownerId,
    inviteCode: inviteCode.value,
    members,
    createdAt: row.createdAt.toJSDate(),
  })
}
