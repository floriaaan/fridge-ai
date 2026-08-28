import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { FridgeListScreen } from './fridge-list-screen.js'

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('renders every fixture product by name', async () => {
  await renderWithProviders(<FridgeListScreen />)

  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())
  expect(screen.getByText('Épinards surgelés')).toBeTruthy()
  expect(screen.getByText('Riz basmati')).toBeTruthy()
})

test('filtering by "freezer" hides products in other locations', async () => {
  await renderWithProviders(<FridgeListScreen />)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('fridge-filter-freezer'))

  await waitFor(() => expect(screen.queryByText('Lait demi-écrémé')).toBeNull())
  await waitFor(() => expect(screen.getByText('Épinards surgelés')).toBeTruthy())
})
