import { APIError } from 'better-auth'
import { auth } from './instance.js'
import type {
  Authentication,
  AuthenticationError,
  PasswordCredentials,
} from '#domain/identity/interfaces/authentication.interface'
import type { AuthenticatedUser as AuthenticatedUserType } from '#domain/identity/authenticated-user.vo'
import { AuthenticatedUser } from '#domain/identity/authenticated-user.vo'
import type { Result } from '#domain/shared/result'
import { Result as ResultNS } from '#domain/shared/result'

/**
 * The real browser login flow goes through better-auth's own mounted
 * handler at /api/auth/sign-in/email (it sets the response cookie itself —
 * this port's return type has no room for that). This adapter exists for
 * architectural symmetry and any non-browser caller.
 */
export class BetterAuthAuthentication implements Authentication {
  async signInWithPassword(
    credentials: PasswordCredentials,
  ): Promise<Result<AuthenticatedUserType, AuthenticationError>> {
    try {
      const result = await auth.api.signInEmail({
        body: { email: credentials.email.value, password: credentials.password },
      })
      return ResultNS.ok(
        AuthenticatedUser.create({
          id: result.user.id,
          email: credentials.email,
          name: result.user.name,
        }),
      )
    } catch (error) {
      if (error instanceof APIError) return ResultNS.err('invalid_credentials')
      throw error
    }
  }

  async signOut(sessionToken: string): Promise<void> {
    await auth.api.signOut({ headers: new Headers({ cookie: sessionToken }) })
  }
}
