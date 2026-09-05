import type { Household } from '../../../domain/identity/household.js'

export const fakeHousehold: Household = {
  id: 'fake-household-1',
  name: 'Maison Bellevue',
  inviteCode: 'FRIDGE-4KQ2',
  role: 'owner',
  members: [
    { userId: 'fake-user-1', name: 'Demo User', role: 'owner', joinedAt: '2026-08-01T09:00:00.000Z' },
    { userId: 'fake-user-2', name: 'Camille', role: 'member', joinedAt: '2026-08-04T18:30:00.000Z' },
  ],
}
