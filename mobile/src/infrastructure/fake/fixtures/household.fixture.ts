import type { Household } from '../../../domain/identity/household.js'

/**
 * `inviteCode` is eight characters of `[A-Z0-9]`, because that is the only
 * shape the backend accepts (`invite-code.vo.ts`). It used to read
 * `FRIDGE-4KQ2` — eleven characters with a hyphen — so the fake taught every
 * screen built against it a format the real server rejects, and the eight-cell
 * join field is developed entirely against this fixture.
 */
export const fakeHousehold: Household = {
  id: 'fake-household-1',
  name: 'Maison Bellevue',
  inviteCode: 'K4Q2M7XP',
  role: 'owner',
  members: [
    { userId: 'fake-user-1', name: 'Demo User', role: 'owner', joinedAt: '2026-08-01T09:00:00.000Z' },
    { userId: 'fake-user-2', name: 'Camille', role: 'member', joinedAt: '2026-08-04T18:30:00.000Z' },
  ],
}
