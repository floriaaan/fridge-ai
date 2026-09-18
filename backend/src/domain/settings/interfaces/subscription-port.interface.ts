export interface SubscriptionPort {
  /**
   * Is this household entitled to the instance's paid (cloud) AI providers?
   * `null` — a user with no household yet — is never entitled.
   */
  hasActiveSubscription(householdId: string | null): Promise<boolean>
}
