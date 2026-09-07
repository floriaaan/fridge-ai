export interface Encryption {
  encrypt(plaintext: string): string
  decrypt(ciphertext: string): string
}
