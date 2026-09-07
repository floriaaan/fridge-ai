import router from '@adonisjs/core/services/router'

const TelemetryController = () => import('./telemetry.controller.js')

/**
 * Mirrors the OTLP/HTTP path layout (`/v1/traces`, `/v1/logs`) so the mobile
 * exporter only has to swap a base URL if the relay is ever removed in favour
 * of a directly reachable collector.
 *
 * No `householdRequired` and no authentication guard: the sign-in and
 * onboarding screens are where telemetry earns its keep, and neither has a
 * household — nor, for part of the flow, a session.
 */
router.post('/api/telemetry/v1/:signal', [TelemetryController, 'ingest'])
