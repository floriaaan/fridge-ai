import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import { parseReceiptDraftJson } from '#domain/receipt/receipt-draft-parser'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'

const EXTRACTION_PROMPT = `Analyse cette photo de ticket de caisse et retourne UNIQUEMENT un JSON de la forme :
{"storeName": string, "scannedAt": string (ISO 8601), "totalAmount": number, "items": [{"name": string, "quantity": number, "unit": string, "category": string | null, "price": number | null}]}
Pas de texte hors du JSON.`

export class OllamaReceiptExtractionAdapter implements ReceiptExtractionPort {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async extract(image: Buffer): Promise<ReceiptDraft> {
    if (!this.model) throw new ReceiptExtractionUnavailableError('ollama')

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: EXTRACTION_PROMPT,
        images: [image.toString('base64')],
        stream: false,
      }),
    })
    if (!response.ok) throw new ReceiptExtractionUnavailableError('ollama')

    const body = (await response.json()) as { response?: string }
    return parseReceiptDraftJson(body.response ?? '')
  }
}
