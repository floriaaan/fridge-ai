import type { AuthMethod } from '../auth-method.vo.js'

export interface AuthMethodsProvider {
  resolve(): Promise<AuthMethod[]>
}
