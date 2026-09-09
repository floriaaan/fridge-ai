import { test } from '@japa/runner'
import { Quantity } from '#domain/fridge/quantity.vo'
import {
  mergeQuantities,
  normalizeShoppingItemName,
} from '#domain/shopping-list/shopping-item-merge'

function qty(amount: number, unit: string): Quantity {
  const result = Quantity.create(amount, unit)
  if (!result.ok) throw new Error('bad fixture')
  return result.value
}

test.group('normalizeShoppingItemName', () => {
  test('folds accents, case and surrounding whitespace', ({ assert }) => {
    assert.equal(normalizeShoppingItemName('  Épinards  '), 'epinards')
  })

  test('collapses internal whitespace runs', ({ assert }) => {
    assert.equal(normalizeShoppingItemName('Farine   de   riz'), 'farine de riz')
  })

  test('two visually-different spellings of the same word normalize equal', ({ assert }) => {
    assert.equal(
      normalizeShoppingItemName('Crème fraîche'),
      normalizeShoppingItemName('CREME FRAICHE'),
    )
  })
})

test.group('mergeQuantities', () => {
  test('same unit: sums the amounts, keeps the unit', ({ assert }) => {
    const merged = mergeQuantities(qty(1, 'kg'), qty(2, 'kg'))
    assert.isNotNull(merged)
    assert.equal(merged?.amount, 3)
    assert.equal(merged?.unit, 'kg')
  })

  test('unit differs only by case/whitespace: still treated as the same unit', ({ assert }) => {
    const merged = mergeQuantities(qty(1, 'Kg'), qty(2, ' kg '))
    assert.isNotNull(merged)
    assert.equal(merged?.amount, 3)
  })

  test('g + kg: converts to the finer unit (g) so the sum stays a whole number', ({ assert }) => {
    const merged = mergeQuantities(qty(300, 'g'), qty(1, 'kg'))
    assert.isNotNull(merged)
    assert.equal(merged?.amount, 1300)
    assert.equal(merged?.unit, 'g')
  })

  test('kg + g: the finer unit wins regardless of argument order', ({ assert }) => {
    const merged = mergeQuantities(qty(1, 'kg'), qty(300, 'g'))
    assert.isNotNull(merged)
    assert.equal(merged?.amount, 1300)
    assert.equal(merged?.unit, 'g')
  })

  test('l + cl: converts to the finer of the two (cl), not all the way to ml', ({ assert }) => {
    const merged = mergeQuantities(qty(1, 'l'), qty(50, 'cl'))
    assert.isNotNull(merged)
    assert.equal(merged?.amount, 150)
    assert.equal(merged?.unit, 'cl')
  })

  test('l + ml: converts to the finer of the two (ml)', ({ assert }) => {
    const merged = mergeQuantities(qty(1, 'l'), qty(500, 'ml'))
    assert.isNotNull(merged)
    assert.equal(merged?.amount, 1500)
    assert.equal(merged?.unit, 'ml')
  })

  test('mass and volume never merge, even both metric', ({ assert }) => {
    assert.isNull(mergeQuantities(qty(1, 'kg'), qty(1, 'l')))
  })

  test('a unit outside the metric tables never merges unless identical', ({ assert }) => {
    assert.isNull(mergeQuantities(qty(1, 'unité'), qty(2, 'sachet')))
  })

  test('two "unité" quantities still sum directly (same-unit path, no table needed)', ({
    assert,
  }) => {
    const merged = mergeQuantities(qty(1, 'unité'), qty(2, 'unité'))
    assert.isNotNull(merged)
    assert.equal(merged?.amount, 3)
    assert.equal(merged?.unit, 'unité')
  })
})
