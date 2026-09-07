import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, syncDestination, targets } from '@adonisjs/core/logger'

const loggerConfig = defineConfig({
  default: 'app',

  loggers: {
    app: {
      enabled: true,
      name: 'fridge-ai-backend',
      level: env.get('LOG_LEVEL'),
      destination: !app.inProduction ? await syncDestination() : undefined,
      transport: {
        targets: [targets.file({ destination: 1 })],
      },
      /**
       * Nothing in this list is ever useful in a log line, and every entry
       * is a credential or a token. `remove: true` deletes the key outright
       * rather than replacing it with "[Redacted]" — the shape of a secret
       * is itself information. These paths also cover the OTLP log records
       * mirrored by `instrumentation-pino`, since redaction happens inside
       * pino, upstream of the bridge.
       */
      redact: {
        remove: true,
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'headers.authorization',
          'headers.cookie',
          'password',
          '*.password',
          'token',
          '*.token',
          'accessToken',
          '*.accessToken',
          'refreshToken',
          '*.refreshToken',
          'idToken',
          '*.idToken',
          'apiKey',
          '*.apiKey',
          'secret',
          '*.secret',
          'inviteCode',
          '*.inviteCode',
        ],
      },
    },
  },
})

export default loggerConfig

declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
