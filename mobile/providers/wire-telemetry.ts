import { telemetry } from '../src/infrastructure/telemetry/telemetry.js'
import { configureTelemetry } from '../src/application/shared/telemetry.js'

/**
 * Same role as `create-connector.ts` — the wiring from the domain-facing
 * `TelemetryPort` to the real infrastructure client lives here, outside
 * `src/`, so nothing under `src/presentation` ever imports infrastructure
 * directly (cf. docs/adr/0002).
 */
export function wireTelemetry(): void {
  configureTelemetry(telemetry)
}
