import { Quantity } from './quantity.js'

test('create() accepts a positive integer amount with a non-empty unit', () => {
  const result = Quantity.create(2, 'L')
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value).toEqual({ amount: 2, unit: 'L' })
})

test('create() trims the unit', () => {
  const result = Quantity.create(1, '  kg  ')
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.value.unit).toBe('kg')
})

test('create() rejects a non-integer amount', () => {
  const result = Quantity.create(1.5, 'kg')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error.field).toBe('quantity')
})

test('create() rejects an amount of 0 or less', () => {
  expect(Quantity.create(0, 'kg').ok).toBe(false)
  expect(Quantity.create(-1, 'kg').ok).toBe(false)
})

test('create() rejects an empty unit', () => {
  const result = Quantity.create(1, '   ')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error.field).toBe('quantity')
})
