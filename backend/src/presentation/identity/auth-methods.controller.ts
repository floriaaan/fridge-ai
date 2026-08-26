import type { HttpContext } from '@adonisjs/core/http'
import { GetAuthMethods } from '#application/identity/get-auth-methods.use-case'

export default class AuthMethodsController {
  async index(ctx: HttpContext) {
    const provider = await ctx.containerResolver.make('identity.authMethodsProvider')
    const methods = await new GetAuthMethods(provider).execute()
    return ctx.response.json({
      methods: methods.map((m) => ({ id: m.id, enabled: m.enabled, label: m.label })),
    })
  }
}
