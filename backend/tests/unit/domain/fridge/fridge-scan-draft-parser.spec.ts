import { test } from '@japa/runner'
import { parseFridgeScanDraftJson } from '#domain/fridge/fridge-scan-draft-parser'
import { ReceiptExtractionParseError } from '#domain/receipt/receipt-extraction.errors'

const VALID_JSON = JSON.stringify({
  items: [
    {
      name: 'Yaourts nature',
      quantity: 4,
      unit: 'pièce',
      category: 'Produits laitiers',
      location: 'fridge',
      expiresInDays: 7,
    },
  ],
})

test.group('parseFridgeScanDraftJson', () => {
  test('parses a well-formed AI response', ({ assert }) => {
    const draft = parseFridgeScanDraftJson(VALID_JSON)
    assert.lengthOf(draft.items, 1)
    assert.equal(draft.items[0]?.name, 'Yaourts nature')
    assert.equal(draft.items[0]?.location, 'fridge')
  })

  test('strips a ```json fenced code block some models wrap the response in', ({ assert }) => {
    const draft = parseFridgeScanDraftJson(`Voici le résultat:\n\`\`\`json\n${VALID_JSON}\n\`\`\``)
    assert.equal(draft.items[0]?.name, 'Yaourts nature')
  })

  test('defaults an unrecognized location to fridge instead of failing', ({ assert }) => {
    const draft = parseFridgeScanDraftJson(
      JSON.stringify({
        items: [{ name: 'X', quantity: 1, unit: 'pièce', location: 'garage' }],
      }),
    )
    assert.equal(draft.items[0]?.location, 'fridge')
  })

  test('throws ReceiptExtractionParseError on invalid JSON', ({ assert }) => {
    assert.throws(() => parseFridgeScanDraftJson('not json'), ReceiptExtractionParseError)
  })

  test('throws ReceiptExtractionParseError when items field is missing', ({ assert }) => {
    assert.throws(() => parseFridgeScanDraftJson(JSON.stringify({})), ReceiptExtractionParseError)
  })

  test('throws ReceiptExtractionParseError when an item is missing required fields', ({
    assert,
  }) => {
    const badItem = JSON.stringify({ items: [{ name: 'X' }] })
    assert.throws(() => parseFridgeScanDraftJson(badItem), ReceiptExtractionParseError)
  })
})
