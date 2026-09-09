import { mergeQuantities, normalizeShoppingItemName } from './shopping-item-merge.js'

describe('normalizeShoppingItemName', () => {
  test('folds accents, case and surrounding whitespace', () => {
    expect(normalizeShoppingItemName('  Épinards  ')).toBe('epinards')
  })

  test('collapses internal whitespace runs', () => {
    expect(normalizeShoppingItemName('Farine   de   riz')).toBe('farine de riz')
  })
})

describe('mergeQuantities', () => {
  test('same unit: sums the amounts, keeps the unit', () => {
    expect(mergeQuantities({ amount: 1, unit: 'kg' }, { amount: 2, unit: 'kg' })).toEqual({ amount: 3, unit: 'kg' })
  })

  test('unit differs only by case/whitespace: still treated as the same unit', () => {
    expect(mergeQuantities({ amount: 1, unit: 'Kg' }, { amount: 2, unit: ' kg ' })).toEqual({ amount: 3, unit: 'Kg' })
  })

  test('g + kg: converts to the finer unit (g)', () => {
    expect(mergeQuantities({ amount: 300, unit: 'g' }, { amount: 1, unit: 'kg' })).toEqual({ amount: 1300, unit: 'g' })
  })

  test('kg + g: the finer unit wins regardless of argument order', () => {
    expect(mergeQuantities({ amount: 1, unit: 'kg' }, { amount: 300, unit: 'g' })).toEqual({ amount: 1300, unit: 'g' })
  })

  test('mass and volume never merge, even both metric', () => {
    expect(mergeQuantities({ amount: 1, unit: 'kg' }, { amount: 1, unit: 'l' })).toBeNull()
  })

  test('a unit outside the metric tables never merges unless identical', () => {
    expect(mergeQuantities({ amount: 1, unit: 'unité' }, { amount: 2, unit: 'sachet' })).toBeNull()
  })

  test('two "unité" quantities still sum directly', () => {
    expect(mergeQuantities({ amount: 1, unit: 'unité' }, { amount: 2, unit: 'unité' })).toEqual({ amount: 3, unit: 'unité' })
  })
})
