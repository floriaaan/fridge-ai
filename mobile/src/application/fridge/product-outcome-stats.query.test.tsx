import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { useProductOutcomeStatsQuery } from './product-outcome-stats.query.js'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  return (
    <QueryClientProvider client={queryClient}>
      <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
    </QueryClientProvider>
  )
}

test('useProductOutcomeStatsQuery() resolves with six buckets and non-zero totals from the seed fixtures', async () => {
  const { result } = await renderHook(() => useProductOutcomeStatsQuery(30), { wrapper })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.buckets).toHaveLength(6)
  expect((result.current.data?.discarded.count ?? 0) + (result.current.data?.consumed.count ?? 0)).toBeGreaterThan(0)
})

test('useProductOutcomeStatsQuery(7) narrows the window to the last 7 days', async () => {
  const { result } = await renderHook(() => useProductOutcomeStatsQuery(7), { wrapper })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  const from = new Date(result.current.data!.from).getTime()
  const to = new Date(result.current.data!.to).getTime()
  expect(to - from).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000)
})

test('useProductOutcomeStatsQuery() without `days` starts at the earliest seeded outcome', async () => {
  const { result } = await renderHook(() => useProductOutcomeStatsQuery(), { wrapper })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  // The oldest fixture is `daysAgo(23)` — comfortably outside a 7-day window.
  const from = new Date(result.current.data!.from).getTime()
  expect(Date.now() - from).toBeGreaterThan(20 * 24 * 60 * 60 * 1000)
})
