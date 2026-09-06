import {
  EXPIRY_WINDOW_LABELS,
  daysUntilExpiry,
  expiryLabel,
  matchesExpiryWindow,
  parseExpiryWindow,
  sortByExpiry,
  statusOf,
} from './product-status.js'

const NOW = new Date('2026-09-05T14:00:00.000Z')

test('an expiry later the same day is zero days away, not a fraction', () => {
  expect(daysUntilExpiry({ expiresAt: '2026-09-05T23:00:00.000Z' }, NOW)).toBe(0)
})

test('a product with no expiry date has no day count and never reads as at risk', () => {
  expect(daysUntilExpiry({ expiresAt: null }, NOW)).toBeNull()
  expect(statusOf(null)).toBe('fresh')
  expect(expiryLabel(null)).toBe('Sans date')
})

test('status thresholds: only a past date is expired, today through three days is soon', () => {
  expect(statusOf(-1)).toBe('expired')
  expect(statusOf(0)).toBe('soon')
  expect(statusOf(3)).toBe('soon')
  expect(statusOf(4)).toBe('fresh')
})

test('labels speak in days, not dates', () => {
  expect(expiryLabel(-2)).toBe('Date dépassée de 2 j')
  expect(expiryLabel(0)).toBe('À consommer aujourd’hui')
  expect(expiryLabel(1)).toBe('À consommer demain')
  expect(expiryLabel(9)).toBe('À consommer sous 9 j')
  expect(expiryLabel(120)).toBe('Longue conservation')
})

test('sorting puts the soonest first and undated products last', () => {
  const sorted = sortByExpiry(
    [
      { id: 'rice', expiresAt: null },
      { id: 'milk', expiresAt: '2026-09-06T00:00:00.000Z' },
      { id: 'peas', expiresAt: '2027-01-01T00:00:00.000Z' },
    ],
    NOW,
  )

  expect(sorted.map((p) => p.id)).toEqual(['milk', 'peas', 'rice'])
})

test('the "cette semaine" window counts today, so nothing falls between it and "dépassé"', () => {
  expect(matchesExpiryWindow(-1, 'week')).toBe(false)
  expect(matchesExpiryWindow(0, 'week')).toBe(true)
  expect(matchesExpiryWindow(7, 'week')).toBe(true)
  expect(matchesExpiryWindow(8, 'week')).toBe(false)
  expect(matchesExpiryWindow(null, 'week')).toBe(false)
})

test('the "dépassé" window is exactly the products a past date already lost', () => {
  expect(matchesExpiryWindow(-1, 'expired')).toBe(true)
  expect(matchesExpiryWindow(0, 'expired')).toBe(false)
  expect(matchesExpiryWindow(null, 'expired')).toBe(false)
})

test('every window carries the label the card and the filter pill both show', () => {
  expect(EXPIRY_WINDOW_LABELS.week).toBe('Cette semaine')
  expect(EXPIRY_WINDOW_LABELS.expired).toBe('Dates dépassées')
})

test('only the two known windows survive a URL, so a hand-typed one filters nothing', () => {
  expect(parseExpiryWindow('expired')).toBe('expired')
  expect(parseExpiryWindow('week')).toBe('week')
  expect(parseExpiryWindow('banana')).toBeNull()
  expect(parseExpiryWindow(undefined)).toBeNull()
})
