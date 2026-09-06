import { agoLabel, memberName, provenanceLine } from './attribution.js'
import type { Household } from '../../domain/identity/household.js'
import type { Recipe } from '../../domain/recipe/recipe.js'

const NOW = new Date('2026-09-06T12:00:00.000Z')

const household: Household = {
  id: 'h1',
  name: 'Maison Bellevue',
  role: 'owner',
  members: [
    { userId: 'u1', name: 'Demo User', role: 'owner', joinedAt: NOW.toISOString() },
    { userId: 'u2', name: 'Camille', role: 'member', joinedAt: NOW.toISOString() },
  ],
}

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    createdBy: null,
    cookCount: 0,
    lastCookedAt: null,
    lastCookedBy: null,
    title: 'Poêlée',
    description: null,
    source: 'ai_generated',
    instructions: '1. Cuire.',
    preparationTime: 20,
    tags: [],
    imageKey: null,
    ingredients: [],
    createdAt: NOW.toISOString(),
    ...overrides,
  }
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

test('a member who has left resolves to nothing, never to a stale name', () => {
  expect(memberName('u2', household)).toBe('Camille')
  expect(memberName('u-gone', household)).toBeNull()
  expect(memberName(null, household)).toBeNull()
})

test('what the foyer did with a recipe outranks who typed it in', () => {
  const line = provenanceLine(
    recipe({ createdBy: 'u1', cookCount: 2, lastCookedAt: daysAgo(1), lastCookedBy: 'u2' }),
    household,
    'u1',
    NOW,
  )
  expect(line).toBe('Cuisinée 2 fois · Camille, hier')
})

test('your own name reads as "toi"', () => {
  expect(provenanceLine(recipe({ createdBy: 'u1' }), household, 'u1', NOW)).toBe('Ajoutée par toi')
  expect(provenanceLine(recipe({ createdBy: 'u2' }), household, 'u1', NOW)).toBe('Ajoutée par Camille')
})

test('a row that predates attribution says nothing rather than guessing', () => {
  expect(provenanceLine(recipe(), household, 'u1', NOW)).toBeNull()
  expect(provenanceLine(recipe({ createdBy: 'u-gone' }), household, 'u1', NOW)).toBeNull()
})

test('a cook by someone who has left still says it was cooked', () => {
  const line = provenanceLine(
    recipe({ cookCount: 1, lastCookedAt: daysAgo(4), lastCookedBy: 'u-gone' }),
    household,
    'u1',
    NOW,
  )
  expect(line).toBe('Cuisinée une fois · il y a 4 j')
})

test('dates read in the register the rest of the app uses', () => {
  expect(agoLabel(daysAgo(0), NOW)).toBe('aujourd’hui')
  expect(agoLabel(daysAgo(1), NOW)).toBe('hier')
  expect(agoLabel(daysAgo(4), NOW)).toBe('il y a 4 j')
  expect(agoLabel(daysAgo(90), NOW)).toBe('il y a longtemps')
})
