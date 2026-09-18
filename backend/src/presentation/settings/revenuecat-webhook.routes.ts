import router from '@adonisjs/core/services/router'

const RevenueCatWebhookController = () => import('./revenuecat-webhook.controller.js')

/**
 * Public: RevenueCat has no session, it authenticates with
 * `REVENUECAT_WEBHOOK_SECRET` as a bearer token (cf. the controller).
 */
router.post('/api/webhooks/revenuecat', [RevenueCatWebhookController, 'handle'])
