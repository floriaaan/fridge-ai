import type { Email } from '../email.vo.js'
import type { AuthenticatedUser } from '../authenticated-user.vo.js'
import type { Result } from '#domain/shared/result'

export type AuthenticationError = 'invalid_credentials'

export interface PasswordCredentials {
  email: Email
  password: string
}

export interface Authentication {
  signInWithPassword(
    credentials: PasswordCredentials,
  ): Promise<Result<AuthenticatedUser, AuthenticationError>>
  signOut(sessionToken: string): Promise<void>
}
