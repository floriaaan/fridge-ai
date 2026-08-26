import type { UseCase } from '#application/shared/use-case'
import type { Session } from '#domain/identity/interfaces/session.interface'
import type { AuthenticatedUser } from '#domain/identity/authenticated-user.vo'

export interface GetCurrentUserInput {
  sessionToken: string
}

export class GetCurrentUser implements UseCase<GetCurrentUserInput, AuthenticatedUser | null> {
  constructor(private readonly session: Session) {}

  async execute(input: GetCurrentUserInput): Promise<AuthenticatedUser | null> {
    return this.session.resolve(input.sessionToken)
  }
}
