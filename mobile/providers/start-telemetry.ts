import { telemetry } from '../src/infrastructure/telemetry/telemetry.js'

/**
 * Same role as `create-connector.ts`: `src/app/` is routing only, so the wiring
 * to an infrastructure implementation lives here, outside `src/`.
 *
 * Returns the teardown so the root layout can hand it straight back from its
 * effect.
 */
export function startTelemetry(): () => void {
  telemetry.start()
  return () => telemetry.shutdown()
}
