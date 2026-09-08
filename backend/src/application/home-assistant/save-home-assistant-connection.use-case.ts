import type { UseCase } from '#application/shared/use-case'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantClient } from '#domain/home-assistant/interfaces/home-assistant-client.interface'
import type { HostPolicy } from '#domain/home-assistant/interfaces/host-policy.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { IdGenerator } from '#domain/shared/id-generator.interface'
import type { Clock } from '#domain/shared/clock.interface'
import type { HomeAssistantError } from '#domain/home-assistant/home-assistant-error'
import { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import { InstanceUrl } from '#domain/home-assistant/instance-url.vo'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export interface SaveHomeAssistantConnectionInput {
  userId: string
  householdId: string
  instanceUrl: string
  token: string
}

export type SaveHomeAssistantConnectionError =
  'not_owner' | 'token_required' | 'invalid_url' | 'host_not_allowed' | HomeAssistantError

export class SaveHomeAssistantConnection implements UseCase<
  SaveHomeAssistantConnectionInput,
  ResultType<HomeAssistantLink, SaveHomeAssistantConnectionError>
> {
  constructor(
    private readonly links: HomeAssistantLinkRepository,
    private readonly client: HomeAssistantClient,
    private readonly hostPolicy: HostPolicy,
    private readonly households: HouseholdRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: SaveHomeAssistantConnectionInput,
  ): Promise<ResultType<HomeAssistantLink, SaveHomeAssistantConnectionError>> {
    const household = await this.households.findByUserId(input.userId)
    if (!household || household.ownerId !== input.userId) return Result.err('not_owner')

    const urlResult = InstanceUrl.create(input.instanceUrl)
    if (!urlResult.ok) return Result.err('invalid_url')

    if (!this.hostPolicy.isAllowed(urlResult.value)) return Result.err('host_not_allowed')

    const existing = await this.links.find(input.householdId)
    // A blank token keeps the one already stored, so the owner can fix the
    // URL alone without re-pasting the long-lived token (design §6).
    const token = input.token.length > 0 ? input.token : existing?.token
    if (!token) return Result.err('token_required')

    const ping = await this.client.ping({ instanceUrl: urlResult.value.value, token })
    if (!ping.ok) return Result.err(ping.error)

    const now = this.clock.now()
    const link =
      existing ??
      HomeAssistantLink.create({
        id: this.idGenerator.next(),
        householdId: input.householdId,
        instanceUrl: urlResult.value,
        token,
        createdAt: now,
      })
    link.updateConnection(urlResult.value, token, now)

    await this.links.save(link)
    return Result.ok(link)
  }
}
