import type { Session } from '../../../domain/identity/session.js'

export const fakeSession: Session = {
  user: { id: 'fake-user-1', email: 'demo@example.com', name: 'Demo User', image: null },
}
