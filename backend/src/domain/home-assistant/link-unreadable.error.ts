/** Thrown by the mapper (Task 10) when a stored token fails to decrypt — a
 * changed or lost ENCRYPTION_KEY, or a corrupted row. Caught by the use
 * cases that read a link (Task 11) and turned into `Result.err('link_unreadable')`. */
export class LinkUnreadableError extends Error {
  constructor(linkId: string) {
    super(`Home Assistant link ${linkId} is unreadable (decryption failed).`)
    this.name = 'LinkUnreadableError'
  }
}
