import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import app from '@adonisjs/core/services/app'

/**
 * Registered globally in kernel.ts (router.use, not a named middleware) so
 * `ctx.authenticatedUser` is always set — to `null` when there's no valid
 * session — before any controller runs.
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const cookie = ctx.request.header('cookie')
    if (!cookie) {
      ctx.authenticatedUser = null
      return next()
    }

    const session = await app.container.make('identity.session')
    ctx.authenticatedUser = await session.resolve(cookie)
    return next()
  }
}
