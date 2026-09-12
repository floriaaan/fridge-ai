import type { HttpContext } from '@adonisjs/core/http'
import { getAuthenticatedUser } from '#presentation/shared/auth-context'
import { traceAction } from '#presentation/shared/trace-action'

export default class SessionController {
  async show(ctx: HttpContext) {
    return traceAction(ctx, 'identity', { name: 'GetSession' }, async () => {
      const user = getAuthenticatedUser(ctx)
      ctx.response.json({
        user: user ? { id: user.id, email: user.email.value, name: user.name } : null,
      })
    })
  }
}
