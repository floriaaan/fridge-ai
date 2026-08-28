import { useDomainQuery } from '../shared/use-domain-query.js'

export function useProductQuery(productId: string) {
  return useDomainQuery(['product', productId], (connector) => connector.getProduct(productId), {
    enabled: productId.length > 0,
  })
}
