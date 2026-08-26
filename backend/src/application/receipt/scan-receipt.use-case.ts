import type { UseCase } from '#application/shared/use-case'
import type { ReceiptExtractionPort } from '#domain/receipt/interfaces/receipt-extraction-port.interface'
import type { ReceiptDraft } from '#domain/receipt/receipt-draft'
import { ReceiptExtractionUnavailableError, ReceiptExtractionParseError } from '#domain/receipt/receipt-extraction.errors'
import { Result } from '#domain/shared/result'
import type { Result as ResultType } from '#domain/shared/result'

export type ScanReceiptError = 'provider_not_configured' | 'extraction_failed'

export class ScanReceipt implements UseCase<{ image: Buffer }, ResultType<ReceiptDraft, ScanReceiptError>> {
  constructor(private readonly extraction: ReceiptExtractionPort) {}

  async execute(input: { image: Buffer }): Promise<ResultType<ReceiptDraft, ScanReceiptError>> {
    try {
      const draft = await this.extraction.extract(input.image)
      return Result.ok(draft)
    } catch (error) {
      if (error instanceof ReceiptExtractionUnavailableError) return Result.err('provider_not_configured')
      if (error instanceof ReceiptExtractionParseError) return Result.err('extraction_failed')
      throw error
    }
  }
}
