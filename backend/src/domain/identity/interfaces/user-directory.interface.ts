import type { Email } from '../email.vo.js'
import type { User } from '../user.entity.js'

export interface UserDirectory {
  findById(id: string): Promise<User | null>
  findByIds(ids: string[]): Promise<User[]>
  findByEmail(email: Email): Promise<User | null>
}
