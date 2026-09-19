import type { UseCase } from '#application/shared/use-case'
import type { SubscriptionPort } from '#domain/settings/interfaces/subscription-port.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'
import type { Clock } from '#domain/shared/clock.interface'

export interface StripeSubscriptionEvent {
  type: string
  subscription: {
    id: string
    customer: string
    status: string
    /** Unix seconds. `null` when Stripe did not send one. */
    currentPeriodEnd: number | null
    metadata: Record<string, string>
  }
}

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

/** Statuses that still entitle the household — `past_due` keeps access while Stripe retries the card. */
const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due'])

/**
 * Reduces every Stripe subscription event to "here is the household's new
 * `expires_at`": the end of the paid period while the subscription is
 * entitled (a cancellation scheduled for period end stays `active` until
 * then), `now` otherwise. Same shape as the RevenueCat flow it replaced —
 * Stripe is the source of truth, this only mirrors it.
 *
 * `metadata.household_id` is set by Checkout on the subscription itself.
 * Unknown households (deleted after purchase), foreign events and event
 * types we do not act on are silent no-ops: Stripe only cares about the 200.
 */
export class HandleStripeWebhook implements UseCase<StripeSubscriptionEvent, void> {
  constructor(
    private readonly subscriptions: SubscriptionPort,
    private readonly households: HouseholdRepository,
    private readonly clock: Clock,
  ) {}

  async execute(event: StripeSubscriptionEvent): Promise<void> {
    if (!SUBSCRIPTION_EVENTS.has(event.type)) return
    const { subscription } = event

    const householdId = subscription.metadata.household_id
    if (!householdId) return
    const household = await this.households.findById(householdId)
    if (!household) return

    const now = this.clock.now()
    const entitled = ENTITLED_STATUSES.has(subscription.status) && subscription.currentPeriodEnd !== null
    const expiresAt = entitled ? new Date(subscription.currentPeriodEnd! * 1000) : now

    // Stripe does not order events: the end of an old subscription (e.g. one
    // cancelled when its payer left, then a new one bought) must not cut
    // access the household now has through another one.
    const existing = await this.subscriptions.find(household.id)
    if (
      !entitled &&
      existing?.stripeSubscriptionId &&
      existing.stripeSubscriptionId !== subscription.id &&
      existing.expiresAt.getTime() > now.getTime()
    ) {
      return
    }

    await this.subscriptions.upsert({
      householdId: household.id,
      payerUserId: subscription.metadata.payer_user_id ?? null,
      stripeCustomerId: subscription.customer,
      stripeSubscriptionId: subscription.id,
      expiresAt,
    })
  }
}
