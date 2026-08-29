import { useDomainQuery } from '../shared/use-domain-query.js'

export function useReceiptQuery(receiptId: string) {
  return useDomainQuery(['receipt', receiptId], (connector) => connector.getReceipt(receiptId), {
    enabled: receiptId.length > 0,
  })
}
