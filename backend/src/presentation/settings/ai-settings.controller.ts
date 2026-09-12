import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { traceAction } from '#presentation/shared/trace-action'
import { setActiveAiProviderValidator } from './ai-settings.validator.js'
import { toAiSettingsDto } from './ai-settings.dto.js'
import { GetEffectiveAiSettings } from '#application/settings/get-effective-ai-settings.use-case'
import { SetActiveAiProvider } from '#application/settings/set-active-ai-provider.use-case'

export default class AiSettingsController {
  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'settings', GetEffectiveAiSettings, async () => {
      const settingsProvider = await ctx.containerResolver.make('settings.aiSettingsProvider')
      const effective = await new GetEffectiveAiSettings(settingsProvider).execute()
      ctx.response.json(toAiSettingsDto(effective))
    })
  }

  async update(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
    return traceAction(ctx, 'settings', SetActiveAiProvider, async () => {
      const payload = await ctx.request.validateUsing(setActiveAiProviderValidator)
      const repository = await ctx.containerResolver.make('settings.aiProviderSettingsRepository')
      const settingsProvider = await ctx.containerResolver.make('settings.aiSettingsProvider')
      const households = await ctx.containerResolver.make('identity.households')
      const idGenerator = await ctx.containerResolver.make('shared.idGenerator')
      const clock = await ctx.containerResolver.make('shared.clock')

      const result = await new SetActiveAiProvider(
        repository,
        settingsProvider,
        households,
        idGenerator,
        clock,
      ).execute({ userId: user.id, provider: payload.provider })

      if (!result.ok) {
        const { status, body } = serializeError(result.error)
        ctx.response.status(status).json(body)
        return result
      }

      const effective = await settingsProvider.resolveEffective()
      ctx.response.json(toAiSettingsDto(effective))
      return result
    }, { isError: (r) => !r.ok })
  }
}
