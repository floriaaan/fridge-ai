import type { ApplicationService } from '@adonisjs/core/types'
import type { TelemetryRelay } from '#domain/shared/interfaces/telemetry-relay.interface'

/**
 * Wires the mobile telemetry relay. Like `shared_provider`, this lives
 * outside `src/` because it is the sanctioned place to bind an
 * infrastructure implementation to a port (cf. docs/adr/0002).
 */
export default class TelemetryProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('telemetry.relay', async () => {
      const { OtlpTelemetryRelay } = await import('#infrastructure/telemetry/otlp-telemetry-relay')
      const envModule = await import('#start/env')
      const env = envModule.default

      return new OtlpTelemetryRelay({
        enabled: env.get('TELEMETRY_INGEST_ENABLED', false),
        endpoint: env.get('TELEMETRY_OTLP_ENDPOINT', 'http://otel-collector:4318'),
        maxBodyBytes: env.get('TELEMETRY_MAX_BODY_BYTES', 262_144),
        rateLimitPerMinute: env.get('TELEMETRY_RATE_LIMIT_PER_MINUTE', 60),
        hashKey: env.get('APP_KEY').release(),
      })
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'telemetry.relay': TelemetryRelay
  }
}
