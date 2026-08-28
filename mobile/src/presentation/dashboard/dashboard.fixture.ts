/**
 * SYNTHETIC DATA — labeled, not wired to a backend.
 *
 * The mobile app has no product/household data layer yet (FridgeConnector
 * only covers identity — see src/domain/interfaces/fridge-connector.ts).
 * This fixture exists to prove the "dashboard soft gamifié" visual
 * direction at full fidelity on the shape mobile phase 2 will eventually
 * fetch for real. `streakDays` in particular has no MVP source at all (no
 * "days without waste" concept exists anywhere in the domain model) — it's
 * fully invented to prove the gamified hero badge and must not survive
 * into a real build without a product decision behind it.
 * Replace this whole file the day a real household-dashboard query lands
 * on FridgeConnector.
 */

export type ProductStatus = 'fresh' | 'soon' | 'expired'

export interface DashboardProduct {
  id: string
  name: string
  location: 'frigo' | 'congélateur' | 'garde-manger'
  daysUntilExpiry: number
  remainingLifePct: number
  status: ProductStatus
}

export interface DashboardFixture {
  householdName: string
  streakDays: number
  productCount: number
  consumptionRatePct: number
  estimatedValueEur: number
  products: DashboardProduct[]
  shoppingListCount: number
  suggestedRecipe: string
}

export const dashboardFixture: DashboardFixture = {
  householdName: 'Foyer Leroux',
  streakDays: 12,
  productCount: 12,
  consumptionRatePct: 78,
  estimatedValueEur: 42,
  products: [
    { id: '1', name: 'Yaourts nature x4', location: 'frigo', daysUntilExpiry: 0, remainingLifePct: 4, status: 'expired' },
    { id: '2', name: 'Filet de poulet', location: 'frigo', daysUntilExpiry: 1, remainingLifePct: 15, status: 'soon' },
    { id: '3', name: 'Épinards frais', location: 'frigo', daysUntilExpiry: 2, remainingLifePct: 22, status: 'soon' },
    { id: '4', name: 'Lait demi-écrémé', location: 'frigo', daysUntilExpiry: 6, remainingLifePct: 60, status: 'fresh' },
    { id: '5', name: 'Petits pois surgelés', location: 'congélateur', daysUntilExpiry: 200, remainingLifePct: 90, status: 'fresh' },
    { id: '6', name: 'Riz basmati', location: 'garde-manger', daysUntilExpiry: 400, remainingLifePct: 96, status: 'fresh' },
  ],
  shoppingListCount: 5,
  suggestedRecipe: 'Poêlée poulet-épinards',
}

export function statusOf(daysUntilExpiry: number): ProductStatus {
  if (daysUntilExpiry <= 0) return 'expired'
  if (daysUntilExpiry <= 3) return 'soon'
  return 'fresh'
}

export function expiryLabel(daysUntilExpiry: number): string {
  if (daysUntilExpiry < 0) return `Périmé depuis ${Math.abs(daysUntilExpiry)} j`
  if (daysUntilExpiry === 0) return 'Périme aujourd’hui'
  if (daysUntilExpiry === 1) return 'Périme demain'
  if (daysUntilExpiry <= 30) return `Périme dans ${daysUntilExpiry} j`
  return 'Longue conservation'
}
