import db from '@adonisjs/lucid/services/db'
import type { UserDirectory } from '#domain/identity/interfaces/user-directory.interface'
import { Email } from '#domain/identity/email.vo'
import { User } from '#domain/identity/user.entity'

interface UserRow {
  id: string
  email: string
  name: string
  image: string | null
  created_at: Date | string
}

function toDomain(row: UserRow): User {
  const email = Email.create(row.email)
  if (!email.ok) throw new Error(`Corrupted user row ${row.id}: ${email.error.message}`)

  const createdAt = row.created_at instanceof Date ? row.created_at : new Date(row.created_at)
  return User.create(row.id, { email: email.value, name: row.name, image: row.image, createdAt })
}

/**
 * Reads directly from better-auth's own `user` table — read-only, no
 * writes. Account creation/edits go through better-auth's own API
 * (cf. docs/adr/0004/0005), never through here.
 */
export class BetterAuthUserDirectory implements UserDirectory {
  async findById(id: string): Promise<User | null> {
    const row = await db.from('user').where('id', id).first()
    return row ? toDomain(row) : null
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return []
    const rows = await db.from('user').whereIn('id', ids)
    return rows.map(toDomain)
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await db.from('user').where('email', email.value).first()
    return row ? toDomain(row) : null
  }
}
