import { useDomainQuery } from '../shared/use-domain-query.js'

export function useProductOutcomeStatsQuery(days?: number) {
  return useDomainQuery(['product-outcome-stats', days ?? 'all'], (connector) => connector.getProductOutcomeStats(days))
}
