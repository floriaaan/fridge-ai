import { defineMutation } from '../shared/define-mutation.js'
import type { ImportReceiptInput } from '../../domain/receipt/receipt.js'

export const useImportReceiptMutation = defineMutation((connector, input: ImportReceiptInput) =>
  connector.importReceipt(input),
)
