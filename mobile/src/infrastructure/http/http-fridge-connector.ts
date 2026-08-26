import { authClient } from '../auth/auth-client.js'
import { apiFetch } from './http-client.js'
import { Result } from '../../domain/shared/result.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'
import type { Session } from '../../domain/identity/session.js'
import type { AuthMethod } from '../../domain/identity/auth-method.js'
import type { ApiError } from '../../domain/shared/api-error.js'

function toSession(
  data: { user: { id: string; email: string; name: string; image?: string | null } } | null | undefined,
): Session | null {
  if (!data?.user) return null
  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      image: data.user.image ?? null,
    },
  }
}

export class HttpFridgeConnector implements FridgeConnector {
  async getSession(): Promise<Session | null> {
    const { data } = await authClient.getSession()
    return toSession(data)
  }

  async getAuthMethods(): Promise<AuthMethod[]> {
    const result = await apiFetch<{ methods: AuthMethod[] }>('/api/auth/methods')
    return result.ok ? result.value.methods : []
  }

  async signInEmail(email: string, password: string): Promise<Result<Session, ApiError>> {
    const { error } = await authClient.signIn.email({ email, password })
    if (error) {
      return Result.err({ type: error.code ?? 'sign_in_failed', message: error.message ?? 'Connexion impossible.' })
    }
    const session = await this.getSession()
    if (!session) return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
    return Result.ok(session)
  }

  async signUpEmail(email: string, password: string, name: string): Promise<Result<Session, ApiError>> {
    const { error } = await authClient.signUp.email({ email, password, name })
    if (error) {
      return Result.err({ type: error.code ?? 'sign_up_failed', message: error.message ?? 'Inscription impossible.' })
    }
    const session = await this.getSession()
    if (!session) return Result.err({ type: 'sign_up_failed', message: 'Inscription impossible.' })
    return Result.ok(session)
  }

  async signInSocial(provider: 'pocketid'): Promise<Result<Session, ApiError>> {
    const { error } = await authClient.signIn.social({ provider, callbackURL: '/(tabs)' })
    if (error) {
      return Result.err({ type: error.code ?? 'sign_in_failed', message: error.message ?? 'Connexion impossible.' })
    }
    const session = await this.getSession()
    if (!session) return Result.err({ type: 'sign_in_failed', message: 'Connexion impossible.' })
    return Result.ok(session)
  }

  async signOut(): Promise<void> {
    await authClient.signOut()
  }
}
