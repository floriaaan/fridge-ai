import { DateTime } from 'luxon'
import HouseholdSubscriptionModel from '#infrastructure/database/settings/household-subscription.lucid'
import type {
  HouseholdSubscription,
  SubscriptionPort,
} from '#domain/settings/interfaces/subscription-port.interface'

/**
 * Reads/writes `household_subscription` — only ever consulted on the hosted
 * instance (cf. `EnvAiSettingsProvider`, which short-circuits to
 * `plan: 'self-hosted'` before calling this at all).
 */
export class LucidSubscriptionAdapter implements SubscriptionPort {
  async hasActiveSubscription(householdId: string | null): Promise<boolean> {
    if (!householdId) return false
    const row = await this.find(householdId)
    return row !== null && row.expiresAt.getTime() > Date.now()
  }

  async find(householdId: string): Promise<HouseholdSubscription | null> {
    const row = await HouseholdSubscriptionModel.find(householdId)
    if (!row) return null
    return { payerUserId: row.payerUserId, expiresAt: row.expiresAt.toJSDate() }
  }

  async revokeForPayer(userId: string, now: Date): Promise<void> {
    await HouseholdSubscriptionModel.query()
      .where('payer_user_id', userId)
      .update({ expiresAt: DateTime.fromJSDate(now) })
  }

  async upsert(params: {
    householdId: string
    payerUserId: string | null
    store: 'app_store' | 'play_store'
    expiresAt: Date
  }): Promise<void> {
    await HouseholdSubscriptionModel.updateOrCreate(
      { householdId: params.householdId },
      {
        payerUserId: params.payerUserId,
        store: params.store,
        expiresAt: DateTime.fromJSDate(params.expiresAt),
      },
    )
  }
}
