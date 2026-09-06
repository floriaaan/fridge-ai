import type { HouseholdRole } from '../../domain/identity/household.js'

/** One French label per household role, shared by the Foyer screen and the Réglages foyer card. */
export const ROLE_LABELS: Record<HouseholdRole, string> = { owner: 'Propriétaire', member: 'Membre' }
