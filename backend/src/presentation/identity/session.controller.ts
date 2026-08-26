import type { HttpContext } from '@adonisjs/core/http'
import { getAuthenticatedUser } from '#presentation/shared/auth-context'

export default class SessionController {
  async show(ctx: HttpContext) {
    const user = getAuthenticatedUser(ctx)
    return ctx.response.json({
      user: user ? { id: user.id, email: user.email.value, name: user.name } : null,
    })
  }
}
