import type { Household } from '../household.aggregate.js'
import type { InviteCode } from '../invite-code.vo.js'

export interface HouseholdRepository {
  findById(id: string): Promise<Household | null>
  findByUserId(userId: string): Promise<Household | null>
  findByInviteCode(code: InviteCode): Promise<Household | null>
  save(household: Household): Promise<void>
  delete(id: string): Promise<void>
}
