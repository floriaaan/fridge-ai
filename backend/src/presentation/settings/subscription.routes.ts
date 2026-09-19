import router from '@adonisjs/core/services/router'

const SubscriptionController = () => import('./subscription.controller.js')
const StripeWebhookController = () => import('./stripe-webhook.controller.js')

router.post('/api/settings/subscription/checkout', [SubscriptionController, 'checkout'])
router.post('/api/settings/subscription/portal', [SubscriptionController, 'portal'])

/**
 * Public: Stripe has no session, it authenticates by signing the body with
 * `STRIPE_WEBHOOK_SECRET` (cf. the controller).
 */
router.post('/api/webhooks/stripe', [StripeWebhookController, 'handle'])
