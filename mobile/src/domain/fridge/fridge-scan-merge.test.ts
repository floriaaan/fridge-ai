import { isLikelyDuplicate, mergeScanItems } from './fridge-scan-merge.js'
import type { FridgeScanDraftItem } from './fridge-scan-draft.js'
import type { Product } from './product.js'

function item(overrides: Partial<FridgeScanDraftItem> = {}): FridgeScanDraftItem {
  return {
    name: 'Yaourts',
    quantity: 2,
    unit: 'pièce',
    category: null,
    location: 'fridge',
    expiresInDays: null,
    ...overrides,
  }
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Yaourts',
    quantity: { amount: 2, unit: 'pièce' },
    location: 'fridge',
    expiresAt: null,
    openedAt: null,
    category: 'Laitier',
    categories: null,
    openfoodfactId: null,
    receiptId: null,
    price: null,
    imageKey: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('mergeScanItems', () => {
  test('same name+location across photos: keeps the higher quantity, not the sum', () => {
    const result = mergeScanItems([item({ quantity: 2 }), item({ quantity: 5 }), item({ quantity: 3 })])
    expect(result).toEqual([item({ quantity: 5 })])
  })

  test('same name, different location: kept as two separate items', () => {
    const result = mergeScanItems([item({ location: 'fridge' }), item({ location: 'freezer' })])
    expect(result).toHaveLength(2)
  })

  test('name differs only by accent/case: still treated as the same item', () => {
    const result = mergeScanItems([item({ name: 'Épinards', quantity: 1 }), item({ name: 'epinards', quantity: 4 })])
    expect(result).toEqual([item({ name: 'epinards', quantity: 4 })])
  })
})

describe('isLikelyDuplicate', () => {
  test('normalized name matches an existing product', () => {
    expect(isLikelyDuplicate(item({ name: '  Yaourts  ' }), [product()])).toBe(true)
  })

  test('no match: not flagged', () => {
    expect(isLikelyDuplicate(item({ name: 'Compote' }), [product()])).toBe(false)
  })
})
