import type { ApplicationService } from '@adonisjs/core/types'

// Temporary no-op — adonisrc.ts references this provider ahead of time (matches
// the target docs/phase-0/01-arborescence.md layout); a later task replaces it
// with real Clock/IdGenerator/EventBus bindings once src/domain and
// src/application exist.
export default class SharedProvider {
  constructor(protected app: ApplicationService) {}

  register() {}
}
