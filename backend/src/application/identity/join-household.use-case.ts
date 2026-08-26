import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface JoinHouseholdInput {
  userId: string
  inviteCode: string
}

export type JoinHouseholdError = 'already_in_household' | 'invalid_invite_code'

export class JoinHousehold
  implements UseCase<JoinHouseholdInput, ResultType<Household, JoinHouseholdError>>
{
  constructor(
    private readonly households: HouseholdRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: JoinHouseholdInput): Promise<ResultType<Household, JoinHouseholdError>> {
    const existing = await this.households.findByUserId(input.userId)
    if (existing) return Result.err('already_in_household')

    const codeResult = InviteCode.create(input.inviteCode)
    if (!codeResult.ok) return Result.err('invalid_invite_code')

    const household = await this.households.findByInviteCode(codeResult.value)
    if (!household) return Result.err('invalid_invite_code')

    const added = household.addMember(this.idGenerator.next(), input.userId, this.clock.now())
    if (!added.ok) return Result.err('already_in_household')

    await this.households.save(household)
    return Result.ok(household)
  }
}
