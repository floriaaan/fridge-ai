import OpenAI from 'openai'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import { parseReceiptDraftJson } from '#domain/receipt/receipt-draft-parser'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'
import { RECEIPT_EXTRACTION_PROMPT } from '#domain/receipt/receipt-extraction-prompt'
import { logAiAdapterFailure } from './log-ai-adapter-failure.js'

export class OpenAiReceiptExtractionAdapter implements ReceiptExtractionPort {
  constructor(private readonly apiKey: string) {}

  async extract(image: Buffer): Promise<ReceiptDraft> {
    if (!this.apiKey) throw new ReceiptExtractionUnavailableError('openai')

    const client = new OpenAI({ apiKey: this.apiKey })
    let text: string
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: RECEIPT_EXTRACTION_PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` },
              },
            ],
          },
        ],
      })
      text = response.choices[0]?.message.content ?? ''
    } catch (error) {
      logAiAdapterFailure('receipt-extraction', 'openai', error)
      throw error
    }

    try {
      return parseReceiptDraftJson(text)
    } catch (error) {
      logAiAdapterFailure('receipt-extraction', 'openai', error, text.slice(0, 500))
      throw error
    }
  }
}
