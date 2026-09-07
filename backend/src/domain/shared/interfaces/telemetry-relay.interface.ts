/**
 * The two OTLP signals the mobile app is allowed to relay. Metrics are
 * deliberately absent: mobile RED metrics are derived from the relayed spans
 * by the collector's `spanmetrics` connector, so the phone never has to run
 * a metric SDK, keep aggregation state, or wake the radio for a third
 * pipeline (cf. docs/adr/0011).
 */
export type RelayedTelemetrySignal = 'traces' | 'logs'

/**
 * Who a relayed batch belongs to. `pseudoUserId` is a keyed hash, never the
 * real identifier: enough to follow one person through a debugging session,
 * useless to anyone else reading the telemetry store.
 */
export interface TelemetryAttribution {
  pseudoUserId: string | null
}

/**
 * The backend's telemetry relay: the only path by which a phone reaches the
 * collector. It owns admission (is it enabled, is this client over its
 * quota, is the body too big), pseudonymisation and forwarding, so the
 * controller stays a thin HTTP shell.
 *
 * No method throws, and `forward` never blocks the HTTP response on the
 * collector being reachable — dropped telemetry always beats a failed request.
 */
export interface TelemetryRelay {
  readonly enabled: boolean
  readonly maxBodyBytes: number

  /** Consumes one token for `key`; `false` means the caller is over quota. */
  allow(key: string): boolean

  /** Keyed hash of a user id, stable for the lifetime of `APP_KEY`. */
  pseudonymize(userId: string | null): string | null

  forward(
    signal: RelayedTelemetrySignal,
    payload: unknown,
    attribution: TelemetryAttribution,
  ): Promise<void>
}
