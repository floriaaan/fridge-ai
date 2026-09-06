import { coverage, matchPantry, pickTonight } from './pantry-match.js'
import type { Product } from '../../domain/fridge/product.js'
import type { Recipe } from '../../domain/recipe/recipe.js'

const NOW = new Date('2026-09-06T10:00:00.000Z')

function isoDaysFromNow(days: number): string {
  const date = new Date(NOW)
  date.setUTCDate(date.getUTCDate() + days)
  return `${date.toISOString().slice(0, 10)}T00:00:00.000Z`
}

function product(name: string, { id = name, days }: { id?: string; days?: number | null } = {}): Product {
  return {
    id,
    name,
    quantity: { amount: 1, unit: 'unité' },
    location: 'fridge',
    expiresAt: days === undefined || days === null ? null : isoDaysFromNow(days),
    openedAt: null,
    category: 'divers',
    categories: null,
    openfoodfactId: null,
    receiptId: null,
    price: null,
    imageKey: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  }
}

function recipe(title: string, labels: string[], { productIds = [], createdAt = NOW.toISOString() }: { productIds?: (string | null)[]; createdAt?: string } = {}): Recipe {
  return {
    id: title,
    title,
    description: null,
    source: 'ai_generated',
    instructions: '1. Cuisiner.',
    preparationTime: 20,
    tags: [],
    imageKey: null,
    ingredients: labels.map((label, index) => ({
      id: `${title}-${index}`,
      productId: productIds[index] ?? null,
      label,
      quantity: null,
      unit: null,
    })),
    createdAt,
  }
}

test('an ingredient matches a product through accents, plurals and packaging words', () => {
  const match = matchPantry(
    recipe('Poêlée', ['Épinards frais', 'Filet de poulet', 'Riz basmati']),
    [product('Épinards surgelés'), product('riz')],
    NOW,
  )

  expect(match.owned).toBe(2)
  expect(match.total).toBe(3)
  expect(match.estimated).toBe(true)
})

test('a stored productId counts without being a guess', () => {
  const match = matchPantry(
    recipe('Sauvegardée', ['Yaourt nature'], { productIds: ['p1'] }),
    [product('Autre chose entièrement', { id: 'p1' })],
    NOW,
  )

  expect(match.owned).toBe(1)
  expect(match.estimated).toBe(false)
})

test('short words keep their last letter — "riz" never becomes "ri"', () => {
  const match = matchPantry(recipe('Riz', ['Riz']), [product('Riz basmati')], NOW)

  expect(match.owned).toBe(1)
})

test('a shared filler word is not a match', () => {
  const match = matchPantry(recipe('Saumon', ['Saumon frais']), [product('Épinards frais')], NOW)

  expect(match.owned).toBe(0)
  expect(match.rescue).toBeNull()
})

test('the rescue is the soonest matched product still inside the week', () => {
  const match = matchPantry(
    recipe('Poêlée', ['Épinards', 'Poulet']),
    [product('Épinards', { days: 5 }), product('Poulet', { days: 1 })],
    NOW,
  )

  expect(match.rescue?.name).toBe('Poulet')
})

test('a date already past is never a rescue', () => {
  const match = matchPantry(recipe('Poêlée', ['Poulet']), [product('Poulet', { days: -2 })], NOW)

  expect(match.owned).toBe(1)
  expect(match.rescue).toBeNull()
})

test('tonight ranks by urgency first, then by how much of the recipe is already in the fridge', () => {
  const products = [product('Épinards', { days: 1 }), product('Poulet', { days: 1 }), product('Yaourt', { days: 4 })]
  const urgentAndCovered = recipe('Poêlée', ['Épinards', 'Poulet'])
  const urgentAndBare = recipe('Tarte', ['Épinards', 'Pâte brisée', 'Crème'])
  const laterOne = recipe('Glace', ['Yaourt'])

  const tonight = pickTonight([laterOne, urgentAndBare, urgentAndCovered], products, { now: NOW })

  expect(tonight.map((candidate) => candidate.recipe.title)).toEqual(['Poêlée', 'Tarte', 'Glace'])
  expect(tonight[0].rescueDays).toBe(1)
  expect(coverage(tonight[0].match)).toBe(1)
})

test('nothing due this week means no shortlist rather than a padded one', () => {
  const tonight = pickTonight([recipe('Riz', ['Riz'])], [product('Riz basmati', { days: 40 })], { now: NOW })

  expect(tonight).toEqual([])
})
