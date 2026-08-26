import type { ApplicationService } from '@adonisjs/core/types'
import type { UserDirectory } from '#domain/identity/interfaces/user-directory.interface'
import type { Authentication } from '#domain/identity/interfaces/authentication.interface'
import type { Session } from '#domain/identity/interfaces/session.interface'
import type { AuthMethodsProvider } from '#domain/identity/interfaces/auth-methods-provider.interface'
import type { HouseholdRepository } from '#domain/identity/interfaces/household-repository.interface'

export default class IdentityProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('identity.userDirectory', async () => {
      const { BetterAuthUserDirectory } =
        await import('#infrastructure/database/identity/user-directory.repository')
      return new BetterAuthUserDirectory()
    })

    this.app.container.singleton('identity.authentication', async () => {
      const { BetterAuthAuthentication } =
        await import('#infrastructure/auth/better-auth/authentication.adapter')
      return new BetterAuthAuthentication()
    })

    this.app.container.singleton('identity.session', async () => {
      const { BetterAuthSession } = await import('#infrastructure/auth/better-auth/session.adapter')
      return new BetterAuthSession()
    })

    this.app.container.singleton('identity.authMethodsProvider', async () => {
      const { EnvAuthMethodsProvider } = await import('#infrastructure/auth/auth-methods.provider')
      return new EnvAuthMethodsProvider()
    })

    this.app.container.singleton('identity.authHandler', async () => {
      const { auth } = await import('#infrastructure/auth/better-auth/instance')
      return (request: Request) => auth.handler(request)
    })

    this.app.container.singleton('identity.households', async () => {
      const { LucidHouseholdRepository } =
        await import('#infrastructure/database/identity/household.repository')
      return new LucidHouseholdRepository()
    })
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'identity.userDirectory': UserDirectory
    'identity.authentication': Authentication
    'identity.session': Session
    'identity.authMethodsProvider': AuthMethodsProvider
    'identity.authHandler': (request: Request) => Promise<Response>
    'identity.households': HouseholdRepository
  }
}
