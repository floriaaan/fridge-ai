import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'
import type { Household } from '#domain/identity/household.aggregate'

export interface RegenerateInviteCodeInput {
  userId: string
}

export type RegenerateInviteCodeError = 'no_household' | 'not_owner'

export class RegenerateInviteCode implements UseCase<
  RegenerateInviteCodeInput,
  ResultType<Household, RegenerateInviteCodeError>
> {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(
    input: RegenerateInviteCodeInput,
  ): Promise<ResultType<Household, RegenerateInviteCodeError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household) return Result.err('no_household')
    if (household.ownerId !== input.userId) return Result.err('not_owner')

    household.regenerateInviteCode(InviteCode.generate(this.idGenerator))
    await this.households.save(household)
    return Result.ok(household)
  }
}
