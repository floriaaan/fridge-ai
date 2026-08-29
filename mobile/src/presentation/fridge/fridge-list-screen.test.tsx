import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { FridgeListScreen, isExpired, isExpiringSoon } from './fridge-list-screen.js'
import type { Product } from '../../domain/fridge/product.js'

function fakeProductExpiringIn(days: number | null): Product {
  return {
    id: 'p',
    name: 'Test',
    quantity: { amount: 1, unit: 'pièce' },
    location: 'fridge',
    expiresAt: days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    openedAt: null,
    category: 'Test',
    categories: null,
    openfoodfactId: null,
    receiptId: null,
    price: null,
    imageKey: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

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

test('isExpired is true only for products whose expiry date has already passed', () => {
  expect(isExpired(fakeProductExpiringIn(-1))).toBe(true)
  expect(isExpired(fakeProductExpiringIn(0))).toBe(false)
  expect(isExpired(fakeProductExpiringIn(1))).toBe(false)
  expect(isExpired(fakeProductExpiringIn(null))).toBe(false)
})

test('isExpiringSoon is true only within the window and never for already-expired products', () => {
  expect(isExpiringSoon(fakeProductExpiringIn(-1))).toBe(false)
  expect(isExpiringSoon(fakeProductExpiringIn(0))).toBe(true)
  expect(isExpiringSoon(fakeProductExpiringIn(3))).toBe(true)
  expect(isExpiringSoon(fakeProductExpiringIn(4))).toBe(false)
  expect(isExpiringSoon(fakeProductExpiringIn(null))).toBe(false)
})

test('a product whose expiry date has already passed shows a "Périmé" badge, not "Bientôt périmé"', async () => {
  // fake-product-1 expires 2026-08-30T00:00:00.000Z — move the clock well past it.
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] })
  jest.setSystemTime(new Date('2026-09-15T00:00:00.000Z'))
  try {
    await renderWithProviders(<FridgeListScreen />)
    await waitFor(() => expect(screen.getByText('Lait demi-écrémé')).toBeTruthy())
    expect(screen.getByText('Périmé')).toBeTruthy()
    expect(screen.queryByText('Bientôt périmé')).toBeNull()
  } finally {
    jest.useRealTimers()
  }
})
