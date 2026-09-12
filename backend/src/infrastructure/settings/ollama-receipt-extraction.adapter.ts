import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import { parseReceiptDraftJson } from '#domain/receipt/receipt-draft-parser'
import { ReceiptExtractionUnavailableError } from '#domain/receipt/receipt-extraction.errors'
import { RECEIPT_EXTRACTION_PROMPT } from '#domain/receipt/receipt-extraction-prompt'
import { logAiAdapterFailure } from './log-ai-adapter-failure.js'

export class OllamaReceiptExtractionAdapter implements ReceiptExtractionPort {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async extract(image: Buffer): Promise<ReceiptDraft> {
    if (!this.model) throw new ReceiptExtractionUnavailableError('ollama')

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: RECEIPT_EXTRACTION_PROMPT,
          images: [image.toString('base64')],
          stream: false,
        }),
      })
    } catch (error) {
      // Unreachable host — never surfaced before, silently became the same
      // generic "provider not configured" as a genuinely missing model.
      logAiAdapterFailure('receipt-extraction', 'ollama', error, `unreachable at ${this.baseUrl}`)
      throw new ReceiptExtractionUnavailableError('ollama')
    }
    if (!response.ok) {
      logAiAdapterFailure(
        'receipt-extraction',
        'ollama',
        new Error(`HTTP ${response.status}`),
        await response.text().catch(() => undefined),
      )
      throw new ReceiptExtractionUnavailableError('ollama')
    }

    const body = (await response.json()) as { response?: string }
    const text = body.response ?? ''
    try {
      return parseReceiptDraftJson(text)
    } catch (error) {
      logAiAdapterFailure('receipt-extraction', 'ollama', error, text.slice(0, 500))
      throw error
    }
  }
}
