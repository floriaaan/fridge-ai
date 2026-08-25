import { Entity } from '#domain/shared/entity'
import type { Email } from './email.vo.js'

interface UserProps {
  email: Email
  name: string
  image: string | null
  createdAt: Date
}

/**
 * Read model reconstructed from better-auth's `user` table — never written
 * to directly by this domain (account creation/edits go through
 * better-auth's own API, cf. docs/adr/0004/0005).
 */
export class User extends Entity<string> {
  private props: UserProps

  private constructor(id: string, props: UserProps) {
    super(id)
    this.props = props
  }

  static create(id: string, props: UserProps): User {
    return new User(id, props)
  }

  get email(): Email {
    return this.props.email
  }

  get name(): string {
    return this.props.name
  }

  get image(): string | null {
    return this.props.image
  }

  get createdAt(): Date {
    return this.props.createdAt
  }
}
