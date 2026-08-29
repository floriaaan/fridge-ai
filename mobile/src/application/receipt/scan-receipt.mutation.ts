import { defineMutation } from '../shared/define-mutation.js'

export const useScanReceiptMutation = defineMutation((connector, imageUri: string) => connector.scanReceipt(imageUri))
