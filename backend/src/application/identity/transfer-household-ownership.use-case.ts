import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface TransferHouseholdOwnershipInput {
  userId: string
  newOwnerId: string
}

export type TransferHouseholdOwnershipError = 'no_household' | 'not_owner' | 'not_a_member' | 'already_owner'

export class TransferHouseholdOwnership implements UseCase<
  TransferHouseholdOwnershipInput,
  ResultType<void, TransferHouseholdOwnershipError>
> {
  constructor(private readonly households: HouseholdRepository) {}

  async execute(
    input: TransferHouseholdOwnershipInput,
  ): Promise<ResultType<void, TransferHouseholdOwnershipError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household) return Result.err('no_household')
    if (household.ownerId !== input.userId) return Result.err('not_owner')

    const result = household.transferOwnership(input.newOwnerId)
    if (!result.ok) return Result.err(result.error)

    await this.households.save(household)
    return Result.ok(undefined)
  }
}
