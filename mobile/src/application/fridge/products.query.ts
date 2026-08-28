import { useDomainQuery } from '../shared/use-domain-query.js'
import type { LocationValue } from '../../domain/fridge/location.js'

export function useProductsQuery(params?: { location?: LocationValue; expiringWithinDays?: number }) {
  return useDomainQuery(['products', params ?? {}], (connector) => connector.getProducts(params))
}
