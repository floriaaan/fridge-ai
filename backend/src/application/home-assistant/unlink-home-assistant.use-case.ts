import type { UseCase } from '#application/shared/use-case'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { ShoppingItemRepository } from '#domain/shopping-list/interfaces/shopping-item-repository.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface UnlinkHomeAssistantInput {
  userId: string
  householdId: string
}

export type UnlinkHomeAssistantError = 'not_owner' | 'link_not_found'

export class UnlinkHomeAssistant
  implements UseCase<UnlinkHomeAssistantInput, ResultType<void, UnlinkHomeAssistantError>>
{
  constructor(
    private readonly links: HomeAssistantLinkRepository,
    private readonly items: ShoppingItemRepository,
    private readonly households: HouseholdRepository,
  ) {}

  async execute(input: UnlinkHomeAssistantInput): Promise<ResultType<void, UnlinkHomeAssistantError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household || household.ownerId !== input.userId) return Result.err('not_owner')

    const link = await this.links.find(input.householdId)
    if (!link) return Result.err('link_not_found')

    await this.links.delete(input.householdId)
    await this.items.clearHomeAssistantSync(input.householdId)
    return Result.ok(undefined)
  }
}
