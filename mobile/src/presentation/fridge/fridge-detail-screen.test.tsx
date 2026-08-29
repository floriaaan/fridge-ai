import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { FridgeDetailScreen } from './fridge-detail-screen.js'

// expo-router's imperative `router` is a singleton wired up by the root
// <Slot>/<Stack> navigator. Nothing here mounts that navigator, so calling
// `router.back()` against the real module throws ("router store is not
// ready"). Stub it the same way the app's navigation itself is out of scope
// for this screen-level test — we only assert the delete-confirm flow.
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}))

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

test('renders the product name, quantity, and category', async () => {
  await renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />)

  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())
  expect(screen.getByText('1 L')).toBeTruthy()
  expect(screen.getByText('Produits laitiers')).toBeTruthy()
})

test('pressing delete then confirm removes the product', async () => {
  await renderWithProviders(<FridgeDetailScreen productId="fake-product-1" />)
  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('fridge-detail-delete'))
  await fireEvent.press(screen.getByTestId('fridge-detail-delete-confirm'))

  await waitFor(() => expect(screen.getByTestId('fridge-detail-deleted')).toBeTruthy())
})

test('a failed delete shows an inline error and does not navigate away or invalidate queries', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
  jest.spyOn(connector, 'deleteProduct').mockResolvedValue({
    ok: false,
    error: { type: 'product_not_found', message: 'Produit introuvable.' },
  })

  await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <FridgeDetailScreen productId="fake-product-1" />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())
  invalidateSpy.mockClear()

  await fireEvent.press(screen.getByTestId('fridge-detail-delete'))
  await fireEvent.press(screen.getByTestId('fridge-detail-delete-confirm'))

  await waitFor(() => expect(screen.getByTestId('fridge-detail-delete-error')).toBeTruthy())
  expect(screen.getByText('Produit introuvable.')).toBeTruthy()
  expect(screen.queryByTestId('fridge-detail-deleted')).toBeNull()
  expect(invalidateSpy).not.toHaveBeenCalled()
})
