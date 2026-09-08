import type { UseCase } from '#application/shared/use-case'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import type { Clock } from '#domain/shared/clock.interface'
import { SyncDirection } from '#domain/home-assistant/sync-direction.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface BindHomeAssistantListInput {
  userId: string
  householdId: string
  todoEntityId?: string
  todoEntityName?: string
  direction?: string
  enabled?: boolean
}

export type BindHomeAssistantListError = 'not_owner' | 'link_not_found' | 'invalid_direction'

export class BindHomeAssistantList
  implements UseCase<BindHomeAssistantListInput, ResultType<HomeAssistantLink, BindHomeAssistantListError>>
{
  constructor(
    private readonly links: HomeAssistantLinkRepository,
    private readonly households: HouseholdRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: BindHomeAssistantListInput,
  ): Promise<ResultType<HomeAssistantLink, BindHomeAssistantListError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household || household.ownerId !== input.userId) return Result.err('not_owner')

    const link = await this.links.find(input.householdId)
    if (!link) return Result.err('link_not_found')

    const now = this.clock.now()

    if (input.todoEntityId !== undefined) {
      link.bindList(input.todoEntityId, input.todoEntityName ?? input.todoEntityId, now)
    }
    if (input.direction !== undefined) {
      const direction = SyncDirection.create(input.direction)
      if (!direction.ok) return Result.err('invalid_direction')
      link.changeDirection(direction.value, now)
    }
    if (input.enabled !== undefined) {
      link.setEnabled(input.enabled, now)
    }

    await this.links.save(link)
    return Result.ok(link)
  }
}
