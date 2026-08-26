import { useMutation } from '@tanstack/react-query'
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query'
import { useConnector } from './connector-context.js'
import type { FridgeConnector } from '../../domain/interfaces/fridge-connector.js'

export function useDomainMutation<TVariables, TData>(
  mutationFn: (connector: FridgeConnector, variables: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>,
): UseMutationResult<TData, Error, TVariables> {
  const connector = useConnector()
  return useMutation({ mutationFn: (variables) => mutationFn(connector, variables), ...options })
}
