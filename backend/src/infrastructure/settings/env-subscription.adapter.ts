import env from '#start/env'
import type { SubscriptionPort } from '#domain/settings/interfaces/subscription-port.interface'

/**
 * Self-hosted instances pay their own API bills, so everything is unlocked:
 * `SAAS_MODE=false` (the default) entitles every household.
 *
 * ponytail: on the official SaaS (`SAAS_MODE=true`) this refuses every
 * household — no billing exists yet, so nothing may claim an entitlement.
 * Replace this class with a billing-backed adapter (subscriptions table fed
 * by Stripe webhooks) when that lands; the port is the only seam callers
 * know about.
 */
export class EnvSubscriptionAdapter implements SubscriptionPort {
  async hasActiveSubscription(householdId: string | null): Promise<boolean> {
    if (!householdId) return false
    return !env.get('SAAS_MODE', false)
  }
}
