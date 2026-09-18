export interface HouseholdSubscription {
  payerUserId: string | null
  expiresAt: Date
}

export interface SubscriptionPort {
  /**
   * Is this household entitled to the AI features right now? Always `true`
   * on a self-hosted instance. `null` — a user with no household yet — is
   * never entitled.
   */
  hasActiveSubscription(householdId: string | null): Promise<boolean>

  /** Current entitlement row, if any — `null` when never subscribed. */
  find(householdId: string): Promise<HouseholdSubscription | null>

  /**
   * Upserts the household's entitlement from a RevenueCat webhook event —
   * always sets `expiresAt` to the event's own expiration timestamp, never
   * merges with what was there (cf. `HandleRevenueCatWebhook`, which decides
   * per event type whether that means extending or cutting access short).
   */
  upsert(params: {
    householdId: string
    payerUserId: string | null
    store: 'app_store' | 'play_store'
    expiresAt: Date
  }): Promise<void>

  /**
   * Cuts the household's entitlement short (`expiresAt = now`) for every
   * subscription this user pays for. Called when a payer leaves or is
   * removed from their foyer — the store keeps billing them until they
   * cancel there, but the foyer they paid for loses access immediately.
   * A no-op if the user never paid for anything.
   */
  revokeForPayer(userId: string, now: Date): Promise<void>
}
