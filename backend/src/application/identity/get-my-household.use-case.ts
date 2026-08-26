import type { UseCase } from '#application/shared/use-case'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { Household } from '#domain/identity/household.aggregate'

export interface GetMyHouseholdInput {
  userId: string
}

export class GetMyHousehold implements UseCase<GetMyHouseholdInput, Household | null> {
  constructor(private readonly households: HouseholdRepository) {}

  async execute(input: GetMyHouseholdInput): Promise<Household | null> {
    return this.households.findByUserId(input.userId)
  }
}
