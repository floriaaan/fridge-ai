import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

// Temporary no-op — replaced by Task 7 with the real better-auth-backed resolver.
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    return next()
  }
}
