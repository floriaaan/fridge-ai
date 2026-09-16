import { test } from '@japa/runner'
import { ScanFridge } from '#application/fridge/scan-fridge.use-case'
import {
  ReceiptExtractionUnavailableError,
  ReceiptExtractionParseError,
} from '#domain/receipt/receipt-extraction.errors'
import type { FridgeScanExtractionPort } from '#domain/fridge/interfaces/fridge-scan-extraction-port.interface'
import type { FridgeScanDraft } from '#domain/fridge/fridge-scan-draft'

function fakeExtraction(behavior: () => Promise<FridgeScanDraft>): FridgeScanExtractionPort {
  return { extract: behavior }
}

test.group('ScanFridge', () => {
  test('returns the draft on success', async ({ assert }) => {
    const draft: FridgeScanDraft = { items: [] }
    const useCase = new ScanFridge(fakeExtraction(async () => draft))
    const result = await useCase.execute({ image: Buffer.from('') })
    assert.isTrue(result.ok)
    if (result.ok) assert.strictEqual(result.value, draft)
  })

  test('maps ReceiptExtractionUnavailableError to provider_not_configured', async ({ assert }) => {
    const useCase = new ScanFridge(
      fakeExtraction(async () => {
        throw new ReceiptExtractionUnavailableError('ollama')
      }),
    )
    const result = await useCase.execute({ image: Buffer.from('') })
    assert.deepEqual(result, { ok: false, error: 'provider_not_configured' })
  })

  test('maps ReceiptExtractionParseError to extraction_failed', async ({ assert }) => {
    const useCase = new ScanFridge(
      fakeExtraction(async () => {
        throw new ReceiptExtractionParseError('bad json')
      }),
    )
    const result = await useCase.execute({ image: Buffer.from('') })
    assert.deepEqual(result, { ok: false, error: 'extraction_failed' })
  })

  test('rethrows unrecognized errors', async ({ assert }) => {
    const useCase = new ScanFridge(
      fakeExtraction(async () => {
        throw new Error('boom')
      }),
    )
    await assert.rejects(() => useCase.execute({ image: Buffer.from('') }), 'boom')
  })
})
