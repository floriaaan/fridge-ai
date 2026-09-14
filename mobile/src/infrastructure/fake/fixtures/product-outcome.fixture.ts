import type { ProductOutcome } from '../../../domain/fridge/product-outcome.js'

/** Same fake foyer as `session.fixture.ts` / `recipe.fixture.ts`. */
const ME = 'fake-user-1'
const CAMILLE = 'fake-user-2'

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * A handful of outcomes spread over the last month, mixing discarded and
 * consumed, some tied to a recipe — so `StatsScreen` isn't an empty page the
 * first time anyone opens it in dev. `recordProductOutcome()` still appends
 * to this same array, exactly like every other fixture list here
 * (`fakeProducts`, `fakeRecipes`).
 */
export const fakeProductOutcomes: ProductOutcome[] = [
  {
    id: 'fake-outcome-seed-1',
    productId: 'fake-product-seed-1',
    recordedBy: ME,
    recipeId: null,
    kind: 'discarded',
    discardReason: 'expired',
    productName: 'Yaourts nature',
    category: 'Produits laitiers',
    categories: ['dairy'],
    location: 'fridge',
    quantity: { amount: 4, unit: 'piece' },
    price: 2.4,
    expiresAt: daysAgo(24),
    occurredAt: daysAgo(23),
  },
  {
    id: 'fake-outcome-seed-2',
    productId: 'fake-product-seed-2',
    recordedBy: CAMILLE,
    recipeId: 'fake-recipe-2',
    kind: 'consumed',
    discardReason: null,
    productName: 'Épinards frais',
    category: 'Légumes',
    categories: ['vegetables'],
    location: 'fridge',
    quantity: { amount: 200, unit: 'g' },
    price: 1.8,
    expiresAt: daysAgo(17),
    occurredAt: daysAgo(19),
  },
  {
    id: 'fake-outcome-seed-3',
    productId: 'fake-product-seed-3',
    recordedBy: ME,
    recipeId: null,
    kind: 'discarded',
    discardReason: 'spoiled',
    productName: 'Salade verte',
    category: 'Légumes',
    categories: ['vegetables'],
    location: 'fridge',
    quantity: { amount: 1, unit: 'piece' },
    price: 1.5,
    expiresAt: daysAgo(13),
    occurredAt: daysAgo(12),
  },
  {
    id: 'fake-outcome-seed-4',
    productId: 'fake-product-seed-4',
    recordedBy: ME,
    recipeId: 'fake-recipe-1',
    kind: 'consumed',
    discardReason: null,
    productName: 'Filet de poulet',
    category: 'Viandes',
    categories: ['meat'],
    location: 'fridge',
    quantity: { amount: 300, unit: 'g' },
    price: 4.9,
    expiresAt: daysAgo(8),
    occurredAt: daysAgo(9),
  },
  {
    id: 'fake-outcome-seed-5',
    productId: 'fake-product-seed-5',
    recordedBy: CAMILLE,
    recipeId: null,
    kind: 'consumed',
    discardReason: null,
    productName: 'Riz basmati',
    category: 'Épicerie',
    categories: ['pantry'],
    location: 'pantry',
    quantity: { amount: 150, unit: 'g' },
    price: 0.6,
    expiresAt: null,
    occurredAt: daysAgo(4),
  },
  {
    id: 'fake-outcome-seed-6',
    productId: 'fake-product-seed-6',
    recordedBy: ME,
    recipeId: null,
    kind: 'discarded',
    discardReason: 'disliked',
    productName: 'Compote sans sucre',
    category: 'Épicerie',
    categories: ['pantry'],
    location: 'pantry',
    quantity: { amount: 2, unit: 'piece' },
    price: 1.1,
    expiresAt: daysAgo(-5),
    occurredAt: daysAgo(1),
  },
]
