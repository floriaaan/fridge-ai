import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import { Household } from '#domain/identity/household.aggregate'
import { InviteCode } from '#domain/identity/invite-code.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface CreateHouseholdInput {
  userId: string
  name: string
}

export type CreateHouseholdError = 'already_in_household'

export class CreateHousehold
  implements UseCase<CreateHouseholdInput, ResultType<Household, CreateHouseholdError>>
{
  constructor(
    private readonly households: HouseholdRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateHouseholdInput): Promise<ResultType<Household, CreateHouseholdError>> {
    const existing = await this.households.findByUserId(input.userId)
    if (existing) return Result.err('already_in_household')

    const household = Household.create({
      id: this.idGenerator.next(),
      name: input.name,
      ownerId: input.userId,
      ownerMemberId: this.idGenerator.next(),
      inviteCode: InviteCode.generate(this.idGenerator),
      createdAt: this.clock.now(),
    })

    await this.households.save(household)
    return Result.ok(household)
  }
}
