import type { UseCase } from '#application/shared/use-case'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { LinkUnreadableError } from '#domain/home-assistant/link-unreadable.error'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface GetHomeAssistantLinkInput {
  householdId: string
}

export type GetHomeAssistantLinkError = 'link_unreadable'

export class GetHomeAssistantLink implements UseCase<
  GetHomeAssistantLinkInput,
  ResultType<HomeAssistantLink | null, GetHomeAssistantLinkError>
> {
  constructor(private readonly links: HomeAssistantLinkRepository) {}

  async execute(
    input: GetHomeAssistantLinkInput,
  ): Promise<ResultType<HomeAssistantLink | null, GetHomeAssistantLinkError>> {
    try {
      return Result.ok(await this.links.find(input.householdId))
    } catch (error) {
      if (error instanceof LinkUnreadableError) return Result.err('link_unreadable')
      throw error
    }
  }
}
