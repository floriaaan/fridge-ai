import type { TelemetryPort } from '../../domain/shared/interfaces/telemetry-port.interface.js'

/**
 * Presentation's only door to telemetry. `providers/` wires the real client
 * in at boot (outside `src/`, per docs/adr/0002) — everything under
 * `src/presentation` calls `getTelemetry()` instead of importing
 * `infrastructure/telemetry/telemetry.js` directly, which the
 * `presentation-must-not-depend-on-infrastructure` boundary rule forbids.
 *
 * Unconfigured only in a test that never calls `configureTelemetry()` —
 * every call is then a no-op, since telemetry must never crash the screen
 * it's reporting a failure from.
 */
let port: TelemetryPort | null = null

export function configureTelemetry(telemetry: TelemetryPort): void {
  port = telemetry
}

export function getTelemetry(): TelemetryPort {
  return port ?? { recordError: () => {} }
}
