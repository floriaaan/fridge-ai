import type { HttpContext } from '@adonisjs/core/http'
import { requireAuthenticatedUser } from '#presentation/shared/auth-context'
import { serializeError } from '#presentation/shared/error-serializer'
import { setActiveAiProviderValidator } from './ai-settings.validator.js'
import { toAiSettingsDto } from './ai-settings.dto.js'
import { GetEffectiveAiSettings } from '#application/settings/get-effective-ai-settings.use-case'
import { SetActiveAiProvider } from '#application/settings/set-active-ai-provider.use-case'

export default class AiSettingsController {
  async show(ctx: HttpContext) {
    requireAuthenticatedUser(ctx)
    const settingsProvider = await ctx.containerResolver.make('settings.aiSettingsProvider')
    const effective = await new GetEffectiveAiSettings(settingsProvider).execute()
    return ctx.response.json(toAiSettingsDto(effective))
  }

  async update(ctx: HttpContext) {
    const user = requireAuthenticatedUser(ctx)
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
      return ctx.response.status(status).json(body)
    }

    const effective = await settingsProvider.resolveEffective()
    return ctx.response.json(toAiSettingsDto(effective))
  }
}
