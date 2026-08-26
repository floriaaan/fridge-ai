import { test } from '@japa/runner'
import { parseReceiptDraftJson } from '#domain/receipt/receipt-draft-parser'
import { ReceiptExtractionParseError } from '#domain/receipt/receipt-extraction.errors'

const VALID_JSON = JSON.stringify({
  storeName: 'Carrefour',
  scannedAt: '2026-08-26T18:00:00Z',
  totalAmount: 4.8,
  items: [{ name: 'Lait 1L', quantity: 2, unit: 'piece', category: 'Produits laitiers', price: 2.4 }],
})

test.group('parseReceiptDraftJson', () => {
  test('parses a well-formed AI response', ({ assert }) => {
    const draft = parseReceiptDraftJson(VALID_JSON)
    assert.equal(draft.storeName, 'Carrefour')
    assert.equal(draft.totalAmount, 4.8)
    assert.lengthOf(draft.items, 1)
    assert.equal(draft.items[0]?.name, 'Lait 1L')
  })

  test('strips a ```json fenced code block some models wrap the response in', ({ assert }) => {
    const draft = parseReceiptDraftJson(`Voici le résultat:\n\`\`\`json\n${VALID_JSON}\n\`\`\``)
    assert.equal(draft.storeName, 'Carrefour')
  })

  test('throws ReceiptExtractionParseError on invalid JSON', ({ assert }) => {
    assert.throws(() => parseReceiptDraftJson('not json'), ReceiptExtractionParseError)
  })

  test('throws ReceiptExtractionParseError when required fields are missing', ({ assert }) => {
    assert.throws(() => parseReceiptDraftJson(JSON.stringify({ storeName: 'X' })), ReceiptExtractionParseError)
  })

  test('throws ReceiptExtractionParseError when an item is missing required fields', ({ assert }) => {
    const badItem = JSON.stringify({
      storeName: 'X',
      scannedAt: '2026-08-26T18:00:00Z',
      totalAmount: 1,
      items: [{ name: 'X' }],
    })
    assert.throws(() => parseReceiptDraftJson(badItem), ReceiptExtractionParseError)
  })
})
