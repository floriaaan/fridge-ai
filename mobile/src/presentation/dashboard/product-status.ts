/**
 * Expiry semantics for the whole app, derived from a real `Product`.
 *
 * Replaces the helpers that used to live in `dashboard.fixture.ts` next to
 * synthetic rows: the thresholds (expired at day 0, "soon" up to 3 days) are
 * product rules, not fixture details, and the fridge/detail/dashboard screens
 * all have to agree on them or the same yoghurt reads "Bientôt" on one screen
 * and "Expiré" on the next.
 */
import type { Product } from '../../domain/fridge/product.js'

export type ProductStatus = 'fresh' | 'soon' | 'expired'

const DAY_MS = 24 * 60 * 60 * 1000

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * Both sides of the subtraction are reduced to a calendar day before it, so
 * "expires tonight at 23:00" is 0 days away rather than 0.4 — and so the count
 * never shifts by one just because the device sits in a different timezone
 * than the backend that stamped the date. `expiresAt` is a calendar date the
 * user picked, not an instant, so its own Y-M-D is read straight off the
 * string instead of through the local timezone.
 */
function expiryDay(expiresAt: string): number | null {
  const match = ISO_DATE.exec(expiresAt)
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const parsed = new Date(expiresAt)
  if (Number.isNaN(parsed.getTime())) return null
  return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

/** `null` when the product carries no expiry date at all (rice, spices...). */
export function daysUntilExpiry(product: Pick<Product, 'expiresAt'>, now: Date = new Date()): number | null {
  if (!product.expiresAt) return null
  const expires = expiryDay(product.expiresAt)
  if (expires === null) return null
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((expires - today) / DAY_MS)
}

/**
 * A product expiring *today* is a warning, not a loss — it is exactly the
 * thing the app exists to get you to cook tonight. Only a date already past
 * reads as expired. (The fridge list and the dashboard used to disagree on
 * this, so the same yoghurt read "Bientôt" on one screen and "Expiré" on
 * the next.)
 */
export function statusOf(daysLeft: number | null): ProductStatus {
  if (daysLeft === null) return 'fresh'
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 3) return 'soon'
  return 'fresh'
}

export function productStatus(product: Pick<Product, 'expiresAt'>, now?: Date): ProductStatus {
  return statusOf(daysUntilExpiry(product, now))
}

export function expiryLabel(daysLeft: number | null): string {
  if (daysLeft === null) return 'Sans date'
  if (daysLeft < 0) return `Périmé depuis ${Math.abs(daysLeft)} j`
  if (daysLeft === 0) return 'Périme aujourd’hui'
  if (daysLeft === 1) return 'Périme demain'
  if (daysLeft <= 30) return `Périme dans ${daysLeft} j`
  return 'Longue conservation'
}

/**
 * Soonest first, undated products last — the order every "what do I use up
 * next" surface wants, and the one the fridge list used to lack entirely.
 */
export function sortByExpiry<T extends Pick<Product, 'expiresAt'>>(products: readonly T[], now?: Date): T[] {
  return [...products].sort((a, b) => {
    const left = daysUntilExpiry(a, now)
    const right = daysUntilExpiry(b, now)
    if (left === null && right === null) return 0
    if (left === null) return 1
    if (right === null) return -1
    return left - right
  })
}
