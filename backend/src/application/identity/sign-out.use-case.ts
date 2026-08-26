import type { UseCase } from '#application/shared/use-case'
import type { Authentication } from '#domain/identity/interfaces/authentication.interface'

export interface SignOutInput {
  sessionToken: string
}

export class SignOut implements UseCase<SignOutInput, void> {
  constructor(private readonly authentication: Authentication) {}

  async execute(input: SignOutInput): Promise<void> {
    await this.authentication.signOut(input.sessionToken)
  }
}
