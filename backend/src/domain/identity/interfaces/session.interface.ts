import type { AuthenticatedUser } from '../authenticated-user.vo.js'

export interface Session {
  resolve(sessionToken: string): Promise<AuthenticatedUser | null>
}
