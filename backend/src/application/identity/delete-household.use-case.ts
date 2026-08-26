import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface DeleteHouseholdInput {
  userId: string
}

export type DeleteHouseholdError = 'no_household' | 'not_owner'

export class DeleteHousehold implements UseCase<
  DeleteHouseholdInput,
  ResultType<void, DeleteHouseholdError>
> {
  constructor(private readonly households: HouseholdRepository) {}

  async execute(input: DeleteHouseholdInput): Promise<ResultType<void, DeleteHouseholdError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household) return Result.err('no_household')
    if (household.ownerId !== input.userId) return Result.err('not_owner')

    await this.households.delete(household.id)
    return Result.ok(undefined)
  }
}
