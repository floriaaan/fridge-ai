import env from '#start/env'
import { AuthMethod } from '#domain/identity/auth-method.vo'
import type { AuthMethodsProvider } from '#domain/identity/interfaces/auth-methods-provider.interface'

export class EnvAuthMethodsProvider implements AuthMethodsProvider {
  async resolve(): Promise<AuthMethod[]> {
    const methods: AuthMethod[] = []

    if (!env.get('DISABLE_PASSWORD_LOGIN', false)) {
      methods.push(
        AuthMethod.create({ id: 'password', enabled: true, label: 'Email et mot de passe' }),
      )
    }

    const pocketIdConfigured =
      Boolean(env.get('POCKETID_CLIENT_ID', '')) &&
      Boolean(env.get('POCKETID_CLIENT_SECRET', '')) &&
      Boolean(env.get('POCKETID_ISSUER_URL', ''))

    if (pocketIdConfigured) {
      methods.push(AuthMethod.create({ id: 'pocketid', enabled: true, label: 'PocketID' }))
    }

    return methods
  }
}
