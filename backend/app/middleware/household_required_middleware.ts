import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Household } from '#domain/identity/household.aggregate'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    household: Household
  }
}

/**
 * Attached to route groups scoped to a household's own data (fridge,
 * receipts, shopping list, recipes — Phase 2 onward). Not used by any
 * Phase 1 route: the household endpoints themselves (create/join/mine) must
 * keep working for a user who has no household yet.
 */
export default class HouseholdRequiredMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = requireAuthenticatedUser(ctx)
    const households = await ctx.containerResolver.make('identity.households')
    const household = await households.findByUserId(user.id)

    if (!household) {
      ctx.response.status(403).json({
        error: { type: 'no_household', message: "Vous n'appartenez à aucun foyer." },
      })
      return
    }

    ctx.household = household
    return next()
  }
}
