import type { FridgeScanDraft, FridgeScanDraftItem } from './fridge-scan-draft.js'
import type { LocationValue } from './location.vo.js'
// Reused as-is rather than duplicated under `domain/fridge` — same parse
// failure, same "AI response was not usable" meaning, whether it's a
// receipt or a fridge photo. Renaming them into generic errors here would
// just be churn for no behavioural difference.
import { ReceiptExtractionParseError } from '#domain/receipt/receipt-extraction.errors'

interface RawFridgeScanDraft {
  items?: unknown
}

const VALID_LOCATIONS: readonly LocationValue[] = ['fridge', 'freezer', 'pantry']

/** Models sometimes wrap JSON in a ```json fenced block despite instructions — strip it. */
function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced?.[1] ? fenced[1].trim() : text.trim()
}

function parseItem(item: unknown, index: number): FridgeScanDraftItem {
  if (typeof item !== 'object' || item === null) {
    throw new ReceiptExtractionParseError(`item ${index} is not an object`)
  }
  const record = item as Record<string, unknown>
  if (
    typeof record.name !== 'string' ||
    typeof record.quantity !== 'number' ||
    typeof record.unit !== 'string'
  ) {
    throw new ReceiptExtractionParseError(`item ${index} is missing required fields`)
  }
  return {
    name: record.name,
    quantity: record.quantity,
    unit: record.unit,
    category: typeof record.category === 'string' ? record.category : null,
    // An unrecognized location degrades to "fridge" rather than failing the
    // whole photo — the field is editable in review either way, and it's
    // the majority case regardless.
    location: VALID_LOCATIONS.includes(record.location as LocationValue)
      ? (record.location as LocationValue)
      : 'fridge',
    expiresInDays:
      typeof record.expiresInDays === 'number' &&
      Number.isFinite(record.expiresInDays) &&
      record.expiresInDays >= 0
        ? Math.round(record.expiresInDays)
        : null,
  }
}

/**
 * Turns a vision model's raw text response into a validated
 * `FridgeScanDraft` — shared by all three `FridgeScanExtractionPort`
 * adapters, mirrors `receipt-draft-parser.ts`.
 */
export function parseFridgeScanDraftJson(text: string): FridgeScanDraft {
  const jsonText = extractJsonBlock(text)
  let raw: RawFridgeScanDraft
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new ReceiptExtractionParseError('AI response was not valid JSON')
  }

  if (!Array.isArray(raw.items)) {
    throw new ReceiptExtractionParseError('AI response is missing required fridge-scan fields')
  }

  return { items: raw.items.map(parseItem) }
}
