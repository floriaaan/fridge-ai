import { renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { useFridgeScan } from './use-fridge-scan.js'

test('merged items keep the same reference across re-renders once the scan is done', async () => {
  const connector = new FakeFridgeConnector({ aiLatencyMs: 0 })
  const wrapper = ({ children }: { children: ReactNode }) => <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
  const uris = ['file://a.jpg']
  const { result, rerender } = await renderHook(() => useFridgeScan(uris), { wrapper })

  await waitFor(() => expect(result.current.done).toBe(true))
  const first = result.current.items
  await rerender({})

  expect(result.current.items).toBe(first)
})
