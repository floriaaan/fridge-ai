import type { FridgeScanDraft } from '../../../domain/fridge/fridge-scan-draft.js'

export const fakeFridgeScanDraft: FridgeScanDraft = {
  items: [
    { name: 'Yaourts nature', quantity: 4, unit: 'pièce', category: 'Produits laitiers', location: 'fridge', expiresInDays: 12 },
    { name: 'Épinards surgelés', quantity: 1, unit: 'pièce', category: 'Surgelés', location: 'freezer', expiresInDays: null },
  ],
}
