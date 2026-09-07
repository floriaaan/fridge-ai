import type { HomeAssistantLink } from '../home-assistant-link.aggregate.js'

export interface HomeAssistantLinkRepository {
  find(householdId: string): Promise<HomeAssistantLink | null>
  save(link: HomeAssistantLink): Promise<void>
  delete(householdId: string): Promise<void>
}
