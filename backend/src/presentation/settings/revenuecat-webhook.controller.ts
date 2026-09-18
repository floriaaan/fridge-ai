import { timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { traceAction } from '#presentation/shared/trace-action'
import { revenueCatWebhookValidator } from './revenuecat-webhook.validator.js'
import { HandleRevenueCatWebhook } from '#application/settings/handle-revenuecat-webhook.use-case'

function isAuthorized(ctx: HttpContext): boolean {
  const secret = env.get('REVENUECAT_WEBHOOK_SECRET', '')
  if (!secret) return false

  const header = ctx.request.header('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export default class RevenueCatWebhookController {
  async handle(ctx: HttpContext) {
    // Self-hosted instances have no billing to reconcile — never wired to a
    // RevenueCat project, so a request here is either a misconfiguration or
    // noise, not a request worth a distinct error code.
    if (env.get('INSTANCE_MODE', 'self-hosted') !== 'hosted') {
      return ctx.response.status(404).json({ error: { type: 'not_found' } })
    }
    if (!isAuthorized(ctx)) {
      return ctx.response.status(401).json({ error: { type: 'unauthorized' } })
    }

    return traceAction(
      ctx,
      'settings',
      HandleRevenueCatWebhook,
      async () => {
        const payload = await ctx.request.validateUsing(revenueCatWebhookValidator)
        const subscriberAttributes = ctx.request.input('event.subscriber_attributes') as
          | Record<string, { value: string }>
          | undefined

        const subscriptions = await ctx.containerResolver.make('settings.subscriptions')
        const households = await ctx.containerResolver.make('identity.households')

        await new HandleRevenueCatWebhook(subscriptions, households).execute({
          ...payload.event,
          subscriber_attributes: subscriberAttributes,
        })

        ctx.response.status(200).json({ ok: true })
      },
      { action: 'settings.revenuecat_webhook' },
    )
  }
}
