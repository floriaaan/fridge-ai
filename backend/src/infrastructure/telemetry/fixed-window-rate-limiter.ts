/**
 * A fixed-window counter, in process memory.
 *
 * Deliberately not a package and deliberately not Redis-backed: this app runs
 * as a single backend container in a homelab, so a shared store would add an
 * infrastructure dependency to protect an endpoint that already costs nothing
 * to serve. The tradeoff is explicit — run more than one backend replica and
 * the effective limit becomes `limit × replicas`.
 */
export class FixedWindowRateLimiter {
  private readonly counters = new Map<string, { count: number; resetAt: number }>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number = 60_000,
  ) {}

  /** `true` when the call is allowed; consumes one token. */
  hit(key: string, now: number = Date.now()): boolean {
    // Bounded memory: a flood of distinct keys must not grow the map forever.
    if (this.counters.size > 10_000) this.prune(now)

    const entry = this.counters.get(key)
    if (!entry || entry.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + this.windowMs })
      return true
    }
    if (entry.count >= this.limit) return false
    entry.count += 1
    return true
  }

  private prune(now: number): void {
    for (const [key, entry] of this.counters) {
      if (entry.resetAt <= now) this.counters.delete(key)
    }
  }
}
