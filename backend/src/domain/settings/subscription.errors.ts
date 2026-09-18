/**
 * Thrown when the active AI provider is configured on the instance but gated
 * behind a subscription this household does not have.
 *
 * Carries `status`/`code` like the 401 `requireAuthenticatedUser` throws:
 * the resolution happens in the controller, before any use-case exists to
 * turn it into a `Result.err(...)`, so it travels to the client through
 * `exception-handler.ts` — which renders exactly the `{ error: { type,
 * message } }` shape `error-serializer.ts` produces, and which
 * `trace-action.ts` logs as a routine 4xx rather than a crash.
 */
export class SubscriptionRequiredError extends Error {
  readonly status = 402
  readonly code = 'subscription_required'

  constructor(public readonly provider: string) {
    super('Les modèles IA cloud nécessitent un abonnement actif.')
  }
}
