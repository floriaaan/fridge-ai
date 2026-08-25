import app from '@adonisjs/core/services/app'
import { ExceptionHandler as BaseExceptionHandler } from '@adonisjs/core/http'

type RenderErrorAsJSON = BaseExceptionHandler['renderErrorAsJSON']
type RenderValidationErrorAsJSON = BaseExceptionHandler['renderValidationErrorAsJSON']

/**
 * Only reached for exceptions that escape a controller uncaught. Expected
 * domain/application errors never get here — controllers convert
 * `Result.err(...)` via `error-serializer.ts` and send a normal response
 * before returning. VineJS validation errors and AdonisJS's own
 * self-handling exceptions (route-not-found, etc.) are also handled by the
 * base class before this method runs.
 */
export class HttpExceptionHandler extends BaseExceptionHandler {
  protected debug = !app.inProduction

  async renderErrorAsJSON(...args: Parameters<RenderErrorAsJSON>): ReturnType<RenderErrorAsJSON> {
    const [error, ctx] = args
    if (this.isDebuggingEnabled(ctx)) return super.renderErrorAsJSON(error, ctx)

    // Most escaped exceptions carry a numeric `status` (Adonis convention).
    // better-auth's `APIError` (thrown by `auth.api.*` calls made directly
    // from application code, bypassing the HTTP bridge in auth.routes.ts)
    // is the exception: its `status` is a string status-code key (e.g.
    // "UNPROCESSABLE_ENTITY") and the numeric code lives in `statusCode`.
    const statusCode = (error as unknown as { statusCode?: unknown }).statusCode
    const status =
      typeof error.status === 'number'
        ? error.status
        : typeof statusCode === 'number'
          ? statusCode
          : 500

    ctx.response.status(status).send({
      error: { type: error.code ?? 'internal_error', message: error.message },
    })
  }

  async renderValidationErrorAsJSON(
    ...args: Parameters<RenderValidationErrorAsJSON>
  ): ReturnType<RenderValidationErrorAsJSON> {
    const [error, ctx] = args
    ctx.response.status(error.status).send({
      error: { type: 'validation_failed', message: 'Validation failed.', details: error.messages },
    })
  }
}
