import HomeAssistantLinkModel from './home-assistant-link.lucid.js'
import { toDomain, toPersistence } from './home-assistant-link.mapper.js'
import type { HomeAssistantLinkRepository } from '#domain/home-assistant/interfaces/home-assistant-link-repository.interface'
import type { HomeAssistantLink } from '#domain/home-assistant/home-assistant-link.aggregate'
import type { Encryption } from '#domain/shared/encryption.interface'

export class LucidHomeAssistantLinkRepository implements HomeAssistantLinkRepository {
  constructor(private readonly encryption: Encryption) {}

  async find(householdId: string): Promise<HomeAssistantLink | null> {
    const row = await HomeAssistantLinkModel.query().where('household_id', householdId).first()
    return row ? toDomain(row, this.encryption) : null
  }

  async save(link: HomeAssistantLink): Promise<void> {
    const { id, ...attrs } = toPersistence(link, this.encryption)
    await HomeAssistantLinkModel.updateOrCreate({ id }, attrs)
  }

  async delete(householdId: string): Promise<void> {
    await HomeAssistantLinkModel.query().where('household_id', householdId).delete()
  }
}
