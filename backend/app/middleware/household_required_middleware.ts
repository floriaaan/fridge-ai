import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

// Temporary no-op — replaced by Task 9 with the real household-membership guard.
export default class HouseholdRequiredMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    return next()
  }
}
