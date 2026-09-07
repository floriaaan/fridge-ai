import { test } from '@japa/runner'
import { AesGcmEncryption } from '#infrastructure/shared/aes-gcm-encryption'

const KEY = Buffer.from('ci-test-encryption-key-32-bytes!') // exactly 32 bytes

test.group('AesGcmEncryption', () => {
  test('round-trips a plaintext', ({ assert }) => {
    const encryption = new AesGcmEncryption(KEY)
    const ciphertext = encryption.encrypt('super-secret-token')
    assert.equal(encryption.decrypt(ciphertext), 'super-secret-token')
  })

  test('the same plaintext encrypts to two different ciphertexts (random IV)', ({ assert }) => {
    const encryption = new AesGcmEncryption(KEY)
    assert.notEqual(encryption.encrypt('same'), encryption.encrypt('same'))
  })

  test('decrypt() throws on a tampered ciphertext', ({ assert }) => {
    const encryption = new AesGcmEncryption(KEY)
    const ciphertext = encryption.encrypt('super-secret-token')
    const tampered = ciphertext.slice(0, -4) + 'AAAA'
    assert.throws(() => encryption.decrypt(tampered))
  })

  test('decrypt() throws on an unrecognized format', ({ assert }) => {
    const encryption = new AesGcmEncryption(KEY)
    assert.throws(() => encryption.decrypt('not-a-ciphertext'))
  })

  test('constructor throws on a key that is not 32 bytes', ({ assert }) => {
    assert.throws(() => new AesGcmEncryption(Buffer.from('too-short')))
  })
})
