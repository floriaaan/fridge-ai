import type { UseCase } from '#application/shared/use-case'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantClient } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { TodoEntity } from '#domain/home-assistant/todo-entity'
import type { HomeAssistantError } from '#domain/home-assistant/home-assistant-error'
import type { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { InstanceUrl as InstanceUrlVO } from '#domain/home-assistant/instance-url.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface DiscoverTodoEntitiesInput {
  userId: string
  householdId: string
  instanceUrl?: string
  token?: string
}

export type DiscoverTodoEntitiesError =
  'not_owner' | 'invalid_url' | 'host_not_allowed' | 'link_not_found' | HomeAssistantError

export class DiscoverTodoEntities implements UseCase<
  DiscoverTodoEntitiesInput,
  ResultType<TodoEntity[], DiscoverTodoEntitiesError>
> {
  constructor(
    private readonly links: HomeAssistantLinkRepository,
    private readonly client: HomeAssistantClient,
    private readonly hostPolicy: HostPolicy,
    private readonly households: HouseholdRepository,
  ) {}

  async execute(
    input: DiscoverTodoEntitiesInput,
  ): Promise<ResultType<TodoEntity[], DiscoverTodoEntitiesError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household || household.ownerId !== input.userId) return Result.err('not_owner')

    let instanceUrl: InstanceUrl
    let token: string

    if (input.instanceUrl || input.token) {
      const urlResult = InstanceUrlVO.create(input.instanceUrl ?? '')
      if (!urlResult.ok) return Result.err('invalid_url')
      instanceUrl = urlResult.value
      token = input.token ?? ''
    } else {
      const existing = await this.links.find(input.householdId)
      if (!existing) return Result.err('link_not_found')
      instanceUrl = existing.instanceUrl
      token = existing.token
    }

    if (!this.hostPolicy.isAllowed(instanceUrl)) return Result.err('host_not_allowed')

    return this.client.listTodoEntities({ instanceUrl: instanceUrl.value, token })
  }
}
