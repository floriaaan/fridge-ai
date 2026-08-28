import type { ShoppingItem } from '../../../domain/shopping-list/shopping-item.js'

export const fakeShoppingItems: ShoppingItem[] = [
  {
    id: 'fake-item-1',
    name: 'Lait demi-écrémé',
    quantity: { amount: 2, unit: 'L' },
    checked: false,
    source: 'manual',
    createdAt: '2026-08-26T08:00:00.000Z',
    updatedAt: '2026-08-26T08:00:00.000Z',
  },
  {
    id: 'fake-item-2',
    name: 'Épinards frais',
    quantity: { amount: 1, unit: 'sachet' },
    checked: false,
    source: 'recipe',
    createdAt: '2026-08-26T08:00:00.000Z',
    updatedAt: '2026-08-26T08:00:00.000Z',
  },
  {
    id: 'fake-item-3',
    name: 'Yaourts nature',
    quantity: { amount: 8, unit: 'unités' },
    checked: true,
    source: 'manual',
    createdAt: '2026-08-25T08:00:00.000Z',
    updatedAt: '2026-08-27T08:00:00.000Z',
  },
  {
    id: 'fake-item-4',
    name: 'Riz basmati',
    quantity: { amount: 1, unit: 'kg' },
    checked: false,
    source: 'manual',
    createdAt: '2026-08-25T08:00:00.000Z',
    updatedAt: '2026-08-25T08:00:00.000Z',
  },
  {
    id: 'fake-item-5',
    name: "Filet d'huile d'olive",
    quantity: { amount: 1, unit: 'bouteille' },
    checked: false,
    source: 'recipe',
    createdAt: '2026-08-24T08:00:00.000Z',
    updatedAt: '2026-08-24T08:00:00.000Z',
  },
]
