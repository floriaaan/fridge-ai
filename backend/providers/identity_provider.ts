import type { ApplicationService } from '@adonisjs/core/types'

// Temporary no-op — adonisrc.ts references this provider ahead of time (matches
// the target docs/phase-0/01-arborescence.md layout); replaced by a later task
// with real AuthenticationPort/SessionPort/UserDirectory/HouseholdRepository
// bindings.
export default class IdentityProvider {
  constructor(protected app: ApplicationService) {}

  register() {}
}
