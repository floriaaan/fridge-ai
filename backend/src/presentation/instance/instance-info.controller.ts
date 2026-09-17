import type { HttpContext } from '@adonisjs/core/http'
import { GetInstanceInfo } from '#application/instance/get-instance-info.use-case'
import { traceAction } from '#presentation/shared/trace-action'

export default class InstanceInfoController {
  async show(ctx: HttpContext) {
    return traceAction(ctx, 'instance', GetInstanceInfo, async () => {
      const useCase = await ctx.containerResolver.make('instance.getInstanceInfo')
      const info = await useCase.execute()

      // Unauthenticated, static per deploy: the mobile app pings this both
      // during onboarding (to validate a server URL) and from Réglages.
      ctx.response.header('Cache-Control', 'public, max-age=300')
      ctx.response.json(info)
    })
  }
}
