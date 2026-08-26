import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface RemoveHouseholdMemberInput {
  userId: string
  targetUserId: string
}

export type RemoveHouseholdMemberError =
  | 'no_household'
  | 'not_owner'
  | 'cannot_remove_owner'
  | 'not_a_member'

export class RemoveHouseholdMember
  implements UseCase<RemoveHouseholdMemberInput, ResultType<void, RemoveHouseholdMemberError>>
{
  constructor(private readonly households: HouseholdRepository) {}

  async execute(
    input: RemoveHouseholdMemberInput,
  ): Promise<ResultType<void, RemoveHouseholdMemberError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household) return Result.err('no_household')
    if (household.ownerId !== input.userId) return Result.err('not_owner')

    const removed = household.removeMember(input.targetUserId)
    if (!removed.ok) return Result.err(removed.error)

    await this.households.save(household)
    return Result.ok(undefined)
  }
}
