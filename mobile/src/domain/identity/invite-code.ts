/**
 * The invite code's shape, on this side of the wire.
 *
 * The rule is the backend's (`invite-code.vo.ts`: `^[A-Z0-9]{8}$`, uppercased
 * after a trim), and it is restated here rather than imported because the two
 * packages share no runtime code — but it is restated *once*, so the field that
 * draws eight cells, the button that enables on the eighth, and the deep link
 * that pre-fills them all agree on what a complete code is. A screen that
 * decided this locally would eventually let a seven-character code light up a
 * button the server then rejects.
 */
export const INVITE_CODE_LENGTH = 8

const ALLOWED = /[A-Z0-9]/

/**
 * What the field does to a keystroke: keep the characters the backend accepts,
 * uppercase them, stop at eight. A lowercase code typed one-handed and a code
 * written `K4Q2-M7XP` both come out right.
 *
 * This is **not** an extractor. Handed a whole sentence it returns that
 * sentence's first eight letters and digits, which for `Rejoins-nous :
 * K4Q2M7XP` is `REJOINSN` — pulling a code out of surrounding text is
 * `parseInviteCode`'s job, and conflating the two is what put garbage in the
 * field the first time "Coller" met a real share message.
 */
export function normalizeInviteCode(raw: string): string {
  const upper = raw.toUpperCase()
  let out = ''
  for (const char of upper) {
    if (ALLOWED.test(char)) out += char
    if (out.length === INVITE_CODE_LENGTH) break
  }
  return out
}

export function isCompleteInviteCode(code: string): boolean {
  return normalizeInviteCode(code).length === INVITE_CODE_LENGTH
}

/** How many acceptable characters a string holds in total — uncapped, unlike `normalizeInviteCode`. */
export function countCodeCharacters(raw: string): number {
  let count = 0
  for (const char of raw.toUpperCase()) if (ALLOWED.test(char)) count += 1
  return count
}
