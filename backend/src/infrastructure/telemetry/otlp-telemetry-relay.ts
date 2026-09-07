import { createHmac } from 'node:crypto'
import logger from '@adonisjs/core/services/logger'
import { sanitizeOtlpPayload } from './otlp-sanitizer.js'
import { FixedWindowRateLimiter } from './fixed-window-rate-limiter.js'
import type {
  RelayedTelemetrySignal,
  TelemetryAttribution,
  TelemetryRelay,
} from '#domain/shared/interfaces/telemetry-relay.interface'

const FORWARD_TIMEOUT_MS = 3_000

export interface OtlpTelemetryRelayOptions {
  enabled: boolean
  /** Collector OTLP/HTTP base URL, e.g. `http://otel-collector:4318`. */
  endpoint: string
  maxBodyBytes: number
  rateLimitPerMinute: number
  /** Keying material for pseudonymisation — the app's `APP_KEY`. */
  hashKey: string
}

/**
 * Relays mobile telemetry to the collector over the internal Docker network.
 *
 * The collector itself is never published on a routable interface: it has no
 * authentication, no quota and no notion of a user, so anything that could
 * reach it could also fill the telemetry store. Going through the backend
 * buys session-aware quotas, a body-size ceiling, server-stamped attributes
 * and one less public listener to secure (cf. docs/adr/0011).
 *
 * The forward call is itself traced by `instrumentation-undici`, on purpose:
 * "is the relay reaching the collector" is the first question to ask when
 * mobile telemetry stops arriving.
 */
export class OtlpTelemetryRelay implements TelemetryRelay {
  readonly enabled: boolean
  readonly maxBodyBytes: number

  private readonly limiter: FixedWindowRateLimiter

  constructor(private readonly options: OtlpTelemetryRelayOptions) {
    this.enabled = options.enabled
    this.maxBodyBytes = options.maxBodyBytes
    this.limiter = new FixedWindowRateLimiter(options.rateLimitPerMinute)
  }

  allow(key: string): boolean {
    return this.limiter.hit(key)
  }

  pseudonymize(userId: string | null): string | null {
    if (!userId) return null
    // Truncated: 16 hex characters are plenty to correlate one person's
    // sessions and short enough to stay unattractive as an identifier.
    return createHmac('sha256', this.options.hashKey).update(userId).digest('hex').slice(0, 16)
  }

  async forward(
    signal: RelayedTelemetrySignal,
    payload: unknown,
    attribution: TelemetryAttribution,
  ): Promise<void> {
    const sanitized = sanitizeOtlpPayload(signal, payload, attribution)
    if (!sanitized) return

    try {
      const response = await fetch(`${this.options.endpoint}/v1/${signal}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized),
        signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      })
      if (!response.ok) {
        logger.debug({ signal, status: response.status }, 'telemetry relay rejected by collector')
      }
    } catch (error) {
      logger.debug({ signal, err: error }, 'telemetry relay unreachable')
    }
  }
}
