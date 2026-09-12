import { Quantity } from '#domain/fridge/quantity.vo'

/**
 * "Farine" and "farine" (or "Farine  " with trailing whitespace, or accents
 * a keyboard mangled) must read as the same item — `CreateShoppingItem`
 * uses this to decide whether a new add merges into an existing line.
 * Same fold `pantry-match.ts` uses on the mobile side for its own (looser,
 * estimate-only) name matching, kept independent since these two are
 * different apps with different consequences: this one writes to the DB.
 */
export function normalizeShoppingItemName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Metric mass/volume units, in grams/millilitres. Only these two families
 * convert automatically — "unité", "sachet", "botte"… have no common scale
 * to convert through, so they merge only on an exact (normalized) match.
 */
const MASS_TO_GRAMS: Record<string, number> = {
  g: 1,
  gramme: 1,
  grammes: 1,
  kg: 1000,
  kilo: 1000,
  kilogramme: 1000,
  kilogrammes: 1000,
}
const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  millilitre: 1,
  millilitres: 1,
  cl: 10,
  centilitre: 10,
  centilitres: 10,
  l: 1000,
  litre: 1000,
  litres: 1000,
}

function unitFactor(unit: string): { table: Record<string, number>; factor: number } | null {
  const key = normalizeShoppingItemName(unit)
  // The `in` check above already guarantees the key exists — `noUncheckedIndexedAccess`
  // can't see through it, so the lookup itself still types as possibly `undefined`.
  if (key in MASS_TO_GRAMS) return { table: MASS_TO_GRAMS, factor: MASS_TO_GRAMS[key]! }
  if (key in VOLUME_TO_ML) return { table: VOLUME_TO_ML, factor: VOLUME_TO_ML[key]! }
  return null
}

/**
 * Sums two quantities of what `CreateShoppingItem` has decided is the same
 * item. Same (normalized) unit sums directly. A mass-with-mass or
 * volume-with-volume pair in different units (g/kg, ml/cl/l) converts both
 * to whichever of the two is finer-grained first — always a whole-number
 * result, since every factor in the tables above is an integer multiple of
 * the finer one, and `Quantity` requires a whole number. Anything else
 * (different dimensions, or a unit outside both tables) returns `null`:
 * the caller creates a separate line instead of guessing.
 */
export function mergeQuantities(existing: Quantity, incoming: Quantity): Quantity | null {
  const existingUnit = normalizeShoppingItemName(existing.unit)
  const incomingUnit = normalizeShoppingItemName(incoming.unit)

  if (existingUnit === incomingUnit) {
    const result = Quantity.create(existing.amount + incoming.amount, existing.unit)
    return result.ok ? result.value : null
  }

  const a = unitFactor(existingUnit)
  const b = unitFactor(incomingUnit)
  if (!a || !b || a.table !== b.table) return null

  const targetFactor = Math.min(a.factor, b.factor)
  const targetUnit = a.factor === targetFactor ? existing.unit : incoming.unit
  const totalInTarget = (existing.amount * a.factor + incoming.amount * b.factor) / targetFactor

  const result = Quantity.create(totalInTarget, targetUnit)
  return result.ok ? result.value : null
}
