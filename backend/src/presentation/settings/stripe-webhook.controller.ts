import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { traceAction } from '#presentation/shared/trace-action'
import { isValidStripeSignature } from '#infrastructure/settings/stripe-signature'
import { stripeWebhookValidator } from './stripe-webhook.validator.js'
import { HandleStripeWebhook } from '#application/settings/handle-stripe-webhook.use-case'

export default class StripeWebhookController {
  async handle(ctx: HttpContext) {
    // Self-hosted instances have no billing to reconcile — a request here is
    // misconfiguration or noise, not worth a distinct error code.
    if (env.get('INSTANCE_MODE', 'self-hosted') !== 'hosted') {
      return ctx.response.status(404).json({ error: { type: 'not_found' } })
    }

    const secret = env.get('STRIPE_WEBHOOK_SECRET', '')
    const signature = ctx.request.header('stripe-signature') ?? ''
    const rawBody = ctx.request.raw() ?? ''
    if (!secret || !isValidStripeSignature(rawBody, signature, secret)) {
      return ctx.response.status(401).json({ error: { type: 'unauthorized' } })
    }

    return traceAction(
      ctx,
      'settings',
      HandleStripeWebhook,
      async () => {
        const payload = JSON.parse(rawBody) as { type?: string }
        // The endpoint may be subscribed to more than we act on — ack, don't 400 and get retried.
        if (!payload.type?.startsWith('customer.subscription.')) {
          return ctx.response.status(200).json({ ok: true })
        }
        const event = await stripeWebhookValidator.validate(payload)
        const subscription = event.data.object

        await new HandleStripeWebhook(
          await ctx.containerResolver.make('settings.subscriptions'),
          await ctx.containerResolver.make('identity.households'),
          await ctx.containerResolver.make('shared.clock'),
        ).execute({
          type: event.type,
          subscription: {
            id: subscription.id,
            customer: subscription.customer,
            status: subscription.status,
            currentPeriodEnd:
              subscription.current_period_end ?? subscription.items?.data[0]?.current_period_end ?? null,
            metadata: subscription.metadata ?? {},
          },
        })

        ctx.response.status(200).json({ ok: true })
      },
      { action: 'settings.stripe_webhook' },
    )
  }
}
