import type { Product } from '../../../domain/fridge/product.js'

/**
 * Dates relative to now, never a calendar literal.
 *
 * These fixtures used to carry fixed August 2026 dates. Every day after that
 * week the demo/offline garde-manger drifted further into nonsense — milk three
 * months past its date, nothing ever due — and the two screens whose whole
 * claim is about *this week* (the dashboard's watchlist and Recettes' "Ce soir")
 * were structurally unreachable in the fake connector, so neither could be
 * looked at, reviewed or captured without editing the clock by hand.
 */
function inDays(days: number): string {
  // Midnight *UTC* of a calendar day — the shape every write in this app
  // produces (`new Date('2026-09-06').toISOString()`). Local midnight would
  // land on the previous calendar day east of Greenwich, and every screen here
  // reads the date part of the string.
  const today = new Date()
  return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + days)).toISOString()
}

function daysAgo(days: number): string {
  return inDays(-days)
}

export const fakeProducts: Product[] = [
  {
    id: 'fake-product-1',
    name: 'Lait demi-écrémé',
    quantity: { amount: 1, unit: 'L' },
    location: 'fridge',
    // Tomorrow: the watchlist needs something genuinely urgent, and no recipe
    // uses milk — so it is urgent without also filling "Ce soir".
    expiresAt: inDays(1),
    openedAt: null,
    category: 'Produits laitiers',
    categories: ['lait'],
    openfoodfactId: null,
    receiptId: null,
    price: 1.2,
    imageKey: null,
    createdAt: daysAgo(12),
    updatedAt: daysAgo(12),
  },
  {
    id: 'fake-product-6',
    name: 'Jambon blanc',
    quantity: { amount: 4, unit: 'tranches' },
    location: 'fridge',
    // Already past. A demo garde-manger with nothing overdue can never show the
    // "Dépassé" status, the dashboard's overdue card, or the tone this system
    // chose for it — and no recipe uses jambon, so it stays out of "Ce soir",
    // which is a claim about what is still savable.
    expiresAt: daysAgo(2),
    openedAt: daysAgo(5),
    category: 'Charcuterie',
    categories: ['charcuterie'],
    openfoodfactId: null,
    receiptId: null,
    price: 3.4,
    imageKey: null,
    createdAt: daysAgo(8),
    updatedAt: daysAgo(8),
  },
  {
    id: 'fake-product-4',
    name: 'Yaourts nature',
    quantity: { amount: 4, unit: 'unités' },
    location: 'fridge',
    // Four days: rescues "Yaourts glacés maison", one of the two alternates.
    expiresAt: inDays(4),
    openedAt: null,
    category: 'Produits laitiers',
    categories: ['yaourt'],
    openfoodfactId: null,
    receiptId: null,
    price: 2.1,
    imageKey: null,
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
  },
  {
    id: 'fake-product-2',
    name: 'Épinards frais',
    quantity: { amount: 200, unit: 'g' },
    location: 'fridge',
    // Three days: rescues "Poêlée poulet-épinards", the shortlist's lead.
    expiresAt: inDays(3),
    openedAt: null,
    category: 'Légumes',
    categories: ['légumes'],
    openfoodfactId: null,
    receiptId: null,
    price: 2.5,
    imageKey: null,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: 'fake-product-5',
    name: 'Petits pois surgelés',
    quantity: { amount: 750, unit: 'g' },
    location: 'freezer',
    // Five days: rescues "Riz sauté aux petits pois" — the third candidate, so
    // the rail actually has the lead plus two alternates it was built for.
    expiresAt: inDays(5),
    openedAt: null,
    category: 'Légumes',
    categories: ['légumes', 'surgelés'],
    openfoodfactId: null,
    receiptId: null,
    price: 2.2,
    imageKey: null,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(20),
  },
  {
    id: 'fake-product-3',
    name: 'Riz basmati',
    quantity: { amount: 1, unit: 'kg' },
    location: 'pantry',
    // A cupboard staple with no date at all — the case every screen has to
    // survive without printing "expire dans null jours".
    expiresAt: null,
    openedAt: null,
    category: 'Féculents',
    categories: null,
    openfoodfactId: null,
    receiptId: null,
    price: 3.0,
    imageKey: null,
    createdAt: daysAgo(22),
    updatedAt: daysAgo(22),
  },
]
