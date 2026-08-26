import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface LeaveHouseholdInput {
  userId: string
}

export type LeaveHouseholdError = 'no_household' | 'owner_cannot_leave'

export class LeaveHousehold implements UseCase<
  LeaveHouseholdInput,
  ResultType<void, LeaveHouseholdError>
> {
  constructor(private readonly households: HouseholdRepository) {}

  async execute(input: LeaveHouseholdInput): Promise<ResultType<void, LeaveHouseholdError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household) return Result.err('no_household')
    if (household.ownerId === input.userId) return Result.err('owner_cannot_leave')

    household.removeMember(input.userId)
    await this.households.save(household)
    return Result.ok(undefined)
  }
}
