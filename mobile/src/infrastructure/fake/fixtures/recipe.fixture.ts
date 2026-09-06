import type { Recipe } from '../../../domain/recipe/recipe.js'

/** The demo foyer's two members — `fake-user-1` is the signed-in one (see `session.fixture.ts`). */
const CAMILLE = 'fake-user-2'
const ME = 'fake-user-1'

export const fakeRecipes: Recipe[] = [
  {
    id: 'fake-recipe-1',
    createdBy: ME,
    cookCount: 0,
    lastCookedAt: null,
    lastCookedBy: null,
    title: 'Poêlée poulet-épinards',
    description: 'Rapide, utilise le poulet et les épinards proches de la péremption.',
    source: 'ai_generated',
    instructions:
      "1. Faire revenir le poulet coupé en dés 8 min.\n2. Ajouter les épinards, laisser tomber 3 min.\n3. Assaisonner, servir avec du riz.",
    preparationTime: 20,
    tags: ['rapide', 'anti-gaspi'],
    imageKey: null,
    ingredients: [
      { id: 'ing-1', productId: null, label: 'Filet de poulet', quantity: 300, unit: 'g' },
      { id: 'ing-2', productId: null, label: 'Épinards frais', quantity: 200, unit: 'g' },
      { id: 'ing-3', productId: null, label: 'Riz basmati', quantity: 150, unit: 'g' },
    ],
    createdAt: '2026-08-27T08:00:00.000Z',
  },
  {
    id: 'fake-recipe-2',
    // Someone else's, and the foyer has made it twice — the two facts the
    // library row exists to carry.
    createdBy: CAMILLE,
    cookCount: 2,
    lastCookedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    lastCookedBy: CAMILLE,
    title: 'Yaourts glacés maison',
    description: 'Pour les yaourts à consommer aujourd’hui.',
    source: 'ai_generated',
    instructions: '1. Mixer les yaourts avec du miel.\n2. Congeler 4h en bac.\n3. Servir en boules.',
    preparationTime: 10,
    tags: ['dessert', 'anti-gaspi'],
    imageKey: null,
    ingredients: [{ id: 'ing-4', productId: null, label: 'Yaourts nature', quantity: 4, unit: 'unités' }],
    createdAt: '2026-08-26T08:00:00.000Z',
  },
  {
    id: 'fake-recipe-3',
    createdBy: null,
    cookCount: 0,
    lastCookedAt: null,
    lastCookedBy: null,
    title: 'Riz sauté aux petits pois',
    description: null,
    source: 'manual',
    instructions: '1. Cuire le riz.\n2. Sauter avec les petits pois et un oeuf.\n3. Assaisonner au soja.',
    preparationTime: 25,
    tags: ['végétarien'],
    imageKey: null,
    ingredients: [
      { id: 'ing-5', productId: null, label: 'Riz basmati', quantity: 200, unit: 'g' },
      { id: 'ing-6', productId: null, label: 'Petits pois surgelés', quantity: 150, unit: 'g' },
    ],
    createdAt: '2026-08-20T08:00:00.000Z',
  },
]
