import type { FridgeScanDraft } from '#domain/fridge/fridge-scan-draft'

export interface FridgeScanDraftDto {
  items: {
    name: string
    quantity: number
    unit: string
    category: string | null
    location: string
    expiresInDays: number | null
  }[]
}

export function toFridgeScanDraftDto(draft: FridgeScanDraft): FridgeScanDraftDto {
  return { items: draft.items }
}
