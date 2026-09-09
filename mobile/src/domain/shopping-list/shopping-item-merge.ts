import { Quantity, type QuantityValue } from '../fridge/quantity.js'

/**
 * Client-side mirror of the backend's `shopping-item-merge.ts` — same fold,
 * same two metric tables, same "finer unit wins" rule. Kept independent
 * (not imported across apps) since mobile and backend are separate
 * packages; `FakeFridgeConnector.createShoppingItem` uses this so the fake
 * enforces the same "no duplicate lines" rule the real backend does — it
 * used to just hardcode `source: 'manual'` regardless of input, which is
 * exactly how the missing-`source` bug survived every test until a real
 * device hit it.
 */
export function normalizeShoppingItemName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

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
  if (key in MASS_TO_GRAMS) return { table: MASS_TO_GRAMS, factor: MASS_TO_GRAMS[key] }
  if (key in VOLUME_TO_ML) return { table: VOLUME_TO_ML, factor: VOLUME_TO_ML[key] }
  return null
}

/**
 * Same rule as the backend's: identical (normalized) unit sums directly; a
 * mass-with-mass or volume-with-volume pair in different units converts
 * both to whichever of the two is finer-grained first (always a whole
 * number, since every factor above is an integer multiple of the finer
 * one); anything else returns `null` and the caller keeps two lines.
 */
export function mergeQuantities(existing: QuantityValue, incoming: QuantityValue): QuantityValue | null {
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
