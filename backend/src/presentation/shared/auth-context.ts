import type { HttpContext } from '@adonisjs/core/http'
import type { AuthenticatedUser } from '#domain/identity/authenticated-user.vo'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    authenticatedUser: AuthenticatedUser | null
  }
}

export function getAuthenticatedUser(ctx: HttpContext): AuthenticatedUser | null {
  return ctx.authenticatedUser
}

export function requireAuthenticatedUser(ctx: HttpContext): AuthenticatedUser {
  const user = getAuthenticatedUser(ctx)
  if (!user) {
    throw Object.assign(new Error('Authentication required.'), {
      status: 401,
      code: 'unauthenticated',
    })
  }
  return user
}
