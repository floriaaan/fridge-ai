import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { useConnector } from './connector-context.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'

export function useDomainQuery<TData>(
  queryKey: unknown[],
  queryFn: (connector: FridgeConnector) => Promise<TData>,
  options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>,
): UseQueryResult<TData> {
  const connector = useConnector()
  return useQuery({ queryKey, queryFn: () => queryFn(connector), ...options })
}
