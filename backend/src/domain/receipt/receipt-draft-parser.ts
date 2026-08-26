import type { ReceiptDraft, ReceiptDraftItem } from './receipt-draft.js'
import { ReceiptExtractionParseError } from './receipt-extraction.errors.js'

interface RawReceiptDraft {
  storeName?: unknown
  scannedAt?: unknown
  totalAmount?: unknown
  items?: unknown
}

/** Models sometimes wrap JSON in a ```json fenced block despite instructions — strip it. */
function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced ? fenced[1].trim() : text.trim()
}

function parseItem(item: unknown, index: number): ReceiptDraftItem {
  if (typeof item !== 'object' || item === null) {
    throw new ReceiptExtractionParseError(`item ${index} is not an object`)
  }
  const record = item as Record<string, unknown>
  if (typeof record.name !== 'string' || typeof record.quantity !== 'number' || typeof record.unit !== 'string') {
    throw new ReceiptExtractionParseError(`item ${index} is missing required fields`)
  }
  return {
    name: record.name,
    quantity: record.quantity,
    unit: record.unit,
    category: typeof record.category === 'string' ? record.category : null,
    price: typeof record.price === 'number' ? record.price : null,
  }
}

/**
 * Turns a vision model's raw text response into a validated `ReceiptDraft`
 * — shared by all three `ReceiptExtractionPort` adapters (Task 9), so the
 * extraction prompt's contract is validated in exactly one place.
 */
export function parseReceiptDraftJson(text: string): ReceiptDraft {
  const jsonText = extractJsonBlock(text)
  let raw: RawReceiptDraft
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new ReceiptExtractionParseError('AI response was not valid JSON')
  }

  if (
    typeof raw.storeName !== 'string' ||
    typeof raw.scannedAt !== 'string' ||
    typeof raw.totalAmount !== 'number' ||
    !Array.isArray(raw.items)
  ) {
    throw new ReceiptExtractionParseError('AI response is missing required receipt fields')
  }

  return {
    storeName: raw.storeName,
    scannedAt: new Date(raw.scannedAt),
    totalAmount: raw.totalAmount,
    items: raw.items.map(parseItem),
  }
}
