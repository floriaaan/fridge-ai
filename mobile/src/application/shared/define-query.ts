import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { useDomainQuery } from './use-domain-query.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'

export function defineQuery<TData>(
  queryKey: unknown[],
  queryFn: (connector: FridgeConnector) => Promise<TData>,
) {
  return function useThisQuery(
    options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>,
  ): UseQueryResult<TData> {
    return useDomainQuery(queryKey, queryFn, options)
  }
}
