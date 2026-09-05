import { render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptDetailScreen } from './receipt-detail-screen.js'

// `AppShell` registers its scan action through expo-router's `useFocusEffect`,
// which needs a real navigation container. These screen tests render the shell
// without one, so the hook — and only the hook — is stubbed out.
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: jest.fn(),
}))

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

test('shows the receipt header and its imported products', async () => {
  await renderWithProviders(<ReceiptDetailScreen receiptId="fake-receipt-1" />)

  await waitFor(() => expect(screen.getByText('Carrefour')).toBeTruthy())
})

test('shows a not-found message for an unknown receipt', async () => {
  await renderWithProviders(<ReceiptDetailScreen receiptId="missing" />)

  await waitFor(() => expect(screen.getByText('Ticket introuvable.')).toBeTruthy())
})
