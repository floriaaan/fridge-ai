import { buildShareMessage, parseInviteCode } from './join-link.js'

jest.mock('expo-linking', () => ({
  createURL: (path: string, options?: { queryParams?: Record<string, string> }) =>
    `fridgeai://${path}?code=${options?.queryParams?.code ?? ''}`,
}))

test('a scanned link yields the code, not the letters of the URL around it', () => {
  // The failure this pins: normalizing the whole string would fold `fridgeai`
  // and `join` into the answer and produce eight characters of host and path.
  expect(parseInviteCode('fridgeai://join?code=K4Q2M7XP')).toBe('K4Q2M7XP')
})

test('a bare code scanned or typed is taken as it is', () => {
  expect(parseInviteCode('K4Q2M7XP')).toBe('K4Q2M7XP')
})

test('the whole share message pasted into "Coller" still yields the code', () => {
  // The case that motivated splitting extraction from normalization: reading
  // this string as a code to normalize returns `REJOINS`-shaped garbage.
  const pasted = 'Rejoins « Maison Bellevue » sur Fridge AI.\nCode : K4Q2M7XP\nfridgeai://join?code=K4Q2M7XP'
  expect(parseInviteCode(pasted)).toBe('K4Q2M7XP')
})

test('a code written with a separator is one code, not two halves', () => {
  expect(parseInviteCode('K4Q2-M7XP')).toBe('K4Q2M7XP')
})

test('anything that is not a whole code is null, never a partial pre-fill', () => {
  // A field missing two characters is worse than an empty one: the user has to
  // notice before they can fix it.
  expect(parseInviteCode('K4Q2M7')).toBeNull()
  expect(parseInviteCode('https://example.com/promo')).toBeNull()
  expect(parseInviteCode(undefined)).toBeNull()
})

test('the share message carries the code in plain text, not only the link', () => {
  // The person being invited is by definition the person without the app, so a
  // message carrying only a `fridgeai://` link is useless to them.
  const message = buildShareMessage('Maison Bellevue', 'K4Q2M7XP')
  expect(message).toContain('Maison Bellevue')
  expect(message).toContain('K4Q2M7XP')
  expect(message).toContain('fridgeai://join?code=K4Q2M7XP')
})
