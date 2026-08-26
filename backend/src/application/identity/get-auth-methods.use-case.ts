import type { UseCase } from '#application/shared/use-case'
import type { AuthMethodsProvider } from '#domain/identity/interfaces/auth-methods-provider.interface'
import type { AuthMethod } from '#domain/identity/auth-method.vo'

export class GetAuthMethods implements UseCase<void, AuthMethod[]> {
  constructor(private readonly provider: AuthMethodsProvider) {}

  async execute(): Promise<AuthMethod[]> {
    return this.provider.resolve()
  }
}
