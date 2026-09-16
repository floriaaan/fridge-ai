import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect, test } from 'vitest'
import { ConnectorProvider } from '../shared/connector-context.js'
import { FakeLandingConnector } from '../../infrastructure/fake/fake-landing-connector.js'
import { useInstanceStatsQuery } from './instance-stats.query.js'

function wrapperFor(connector: FakeLandingConnector) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
    </QueryClientProvider>
  )
}

test('useInstanceStatsQuery() resolves with the connector stats', async () => {
  const { result } = renderHook(() => useInstanceStatsQuery(), {
    wrapper: wrapperFor(new FakeLandingConnector()),
  })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.households).toBeGreaterThan(0)
})

test('useInstanceStatsQuery() resolves with null when stats are disabled', async () => {
  const { result } = renderHook(() => useInstanceStatsQuery(), {
    wrapper: wrapperFor(new FakeLandingConnector(null)),
  })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toBeNull()
})
