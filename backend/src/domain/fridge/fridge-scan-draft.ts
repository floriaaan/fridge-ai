import type { LocationValue } from './location.vo.js'

/** Never persisted as-is — the raw result of `FridgeScanExtractionPort.extract()`. */
export interface FridgeScanDraftItem {
  name: string
  quantity: number
  unit: string
  category: string | null
  location: LocationValue
  /** The model's own estimate of days-until-expiry from today — see `fridge-scan-extraction-prompt.ts`. `null` when it has no reasonable guess. */
  expiresInDays: number | null
}

export interface FridgeScanDraft {
  items: FridgeScanDraftItem[]
}
