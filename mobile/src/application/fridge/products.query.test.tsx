import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { useProductsQuery } from './products.query.js'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  return (
    <QueryClientProvider client={queryClient}>
      <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
    </QueryClientProvider>
  )
}

test('useProductsQuery() resolves with the fixture products', async () => {
  const { result } = await renderHook(() => useProductsQuery(), { wrapper })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.length).toBeGreaterThan(0)
})

test('useProductsQuery({ location }) resolves with only that location', async () => {
  const { result } = await renderHook(() => useProductsQuery({ location: 'pantry' }), { wrapper })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.every((p) => p.location === 'pantry')).toBe(true)
})
