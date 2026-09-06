import { INVITE_CODE_LENGTH, isCompleteInviteCode, normalizeInviteCode } from './invite-code.js'

test('separators and lowercase are the user’s problem to make, not to fix', () => {
  expect(normalizeInviteCode('k4q2-m7xp')).toBe('K4Q2M7XP')
  expect(normalizeInviteCode(' K4 Q2 M7 XP ')).toBe('K4Q2M7XP')
})

test('a sentence is not a code — extraction is parseInviteCode’s job, not this one’s', () => {
  // Pinned because conflating the two is a real defect this once had:
  // "Coller" on a whole share message put `REJOINSN` in the field.
  expect(normalizeInviteCode('Rejoins-nous : k4q2m7xp')).toBe('REJOINSN')
})

test('never longer than the field can hold', () => {
  expect(normalizeInviteCode('K4Q2M7XPEXTRA')).toHaveLength(INVITE_CODE_LENGTH)
})

test('completeness is what the join button reads, so a short code is never complete', () => {
  expect(isCompleteInviteCode('K4Q2M7X')).toBe(false)
  expect(isCompleteInviteCode('K4Q2M7XP')).toBe(true)
  // Eight characters, but two of them are not in the alphabet the backend
  // accepts — this is the case a naive `length === 8` check would wave through
  // into a request the server rejects.
  expect(isCompleteInviteCode('K4Q2-M7X')).toBe(false)
})
