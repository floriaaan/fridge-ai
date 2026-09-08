import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { Encryption } from '#domain/shared/encryption.interface'

const ALGORITHM = 'aes-256-gcm'
const VERSION = 'v1'

/**
 * Stored format: `v1.<iv b64>.<tag b64>.<ciphertext b64>`. The version
 * prefix lets a future algorithm change coexist with rows written under
 * this one, rather than guessing a row's format from its shape.
 */
export class AesGcmEncryption implements Encryption {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) {
      throw new Error('AesGcmEncryption requires a 32-byte key.')
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv(ALGORITHM, this.key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return [
      VERSION,
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join('.')
  }

  decrypt(ciphertext: string): string {
    const [version, ivB64, tagB64, dataB64] = ciphertext.split('.')
    if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
      throw new Error('Unrecognized ciphertext format.')
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  }
}
