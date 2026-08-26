import { auth } from './instance.js'
import type { Session } from '#domain/identity/interfaces/session.interface'
import type { AuthenticatedUser as AuthenticatedUserType } from '#domain/identity/authenticated-user.vo'
import { AuthenticatedUser } from '#domain/identity/authenticated-user.vo'
import { Email } from '#domain/identity/email.vo'

/**
 * `sessionToken` here is the raw `Cookie` request header, not a bare token —
 * better-auth resolves sessions from its own (possibly chunked) cookie jar,
 * so re-deriving its cookie name/format in this adapter would be fragile.
 */
export class BetterAuthSession implements Session {
  async resolve(sessionToken: string): Promise<AuthenticatedUserType | null> {
    const result = await auth.api.getSession({ headers: new Headers({ cookie: sessionToken }) })
    if (!result) return null

    const email = Email.create(result.user.email)
    if (!email.ok) return null

    return AuthenticatedUser.create({
      id: result.user.id,
      email: email.value,
      name: result.user.name,
    })
  }
}
