import type { UseCase } from '#application/shared/use-case'
import type { SubscriptionPort } from '#domain/settings/interfaces/subscription-port.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'

export interface RevenueCatWebhookEvent {
  type: string
  app_user_id: string
  expiration_at_ms: number | null
  store: string
  subscriber_attributes?: Record<string, { value: string }>
}

/**
 * Every event type that carries an `expiration_at_ms` this instance should
 * trust as the household's new entitlement boundary — renewal, cancellation
 * (still entitled until the period ends) and billing trouble all reduce to
 * "here is the new expiry", same as an outright expiration.
 */
const ENTITLEMENT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'CANCELLATION',
  'BILLING_ISSUE',
  'EXPIRATION',
])

/**
 * `app_user_id` is the household id (the mobile app calls
 * `Purchases.logIn(householdId)`) — no separate mapping table. Unknown
 * households (deleted after purchase) and event types this instance does
 * not act on both resolve as a silent no-op: RevenueCat only cares that the
 * response is 200, and retrying would not change the outcome.
 */
export class HandleRevenueCatWebhook implements UseCase<RevenueCatWebhookEvent, void> {
  constructor(
    private readonly subscriptions: SubscriptionPort,
    private readonly households: HouseholdRepository,
  ) {}

  async execute(event: RevenueCatWebhookEvent): Promise<void> {
    if (!ENTITLEMENT_EVENTS.has(event.type)) return
    if (event.expiration_at_ms === null) return

    const household = await this.households.findById(event.app_user_id)
    if (!household) return

    await this.subscriptions.upsert({
      householdId: household.id,
      payerUserId: event.subscriber_attributes?.user_id?.value ?? null,
      store: event.store === 'PLAY_STORE' ? 'play_store' : 'app_store',
      expiresAt: new Date(event.expiration_at_ms),
    })
  }
}
