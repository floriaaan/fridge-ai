import OpenAI from 'openai'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import { parseReceiptDraftJson } from '#domain/receipt/receipt-draft-parser'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'

const EXTRACTION_PROMPT = `Analyse cette photo de ticket de caisse et retourne UNIQUEMENT un JSON de la forme :
{"storeName": string, "scannedAt": string (ISO 8601), "totalAmount": number, "items": [{"name": string, "quantity": number, "unit": string, "category": string | null, "price": number | null}]}
Pas de texte hors du JSON.`

export class OpenAiReceiptExtractionAdapter implements ReceiptExtractionPort {
  constructor(private readonly apiKey: string) {}

  async extract(image: Buffer): Promise<ReceiptDraft> {
    if (!this.apiKey) throw new ReceiptExtractionUnavailableError('openai')

    const client = new OpenAI({ apiKey: this.apiKey })
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` },
            },
          ],
        },
      ],
    })

    return parseReceiptDraftJson(response.choices[0]?.message.content ?? '')
  }
}
