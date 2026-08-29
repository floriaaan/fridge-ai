import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptsListScreen } from './receipts-list-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={new FakeFridgeConnector()}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('lists the fixture receipts and navigates to the detail screen on tap', async () => {
  renderWithProviders(<ReceiptsListScreen />)

  await waitFor(() => expect(screen.getByText('Carrefour')).toBeTruthy())

  fireEvent.press(screen.getByText('Carrefour'))

  expect(router.push).toHaveBeenCalledWith({ pathname: '/(tabs)/receipts/[id]', params: { id: 'fake-receipt-1' } })
})
