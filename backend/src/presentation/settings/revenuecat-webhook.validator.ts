import vine from '@vinejs/vine'

/**
 * Only the fields `HandleRevenueCatWebhook` acts on — RevenueCat's payload
 * carries far more (environment, product_id, price…) that this instance has
 * no use for and that would otherwise have to be kept in sync with their
 * schema for no benefit. `subscriber_attributes` is read straight off the
 * request body instead of validated here (cf. `revenuecat-webhook.controller.ts`):
 * it is optional, shaped as a free-form map, and never trusted for anything
 * beyond an informational `payer_user_id`.
 */
export const revenueCatWebhookValidator = vine.compile(
  vine.object({
    event: vine.object({
      type: vine.string(),
      app_user_id: vine.string(),
      expiration_at_ms: vine.number().nullable(),
      store: vine.string(),
    }),
  }),
)
