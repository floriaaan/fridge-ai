import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { HouseholdDashboard } from './household-dashboard.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() }, useFocusEffect: jest.fn() }))

// The fake fridge holds one product whose date is already in the past (milk,
// 2026-08-30), one long-life frozen bag and one undated bag of rice — so the
// expected counts hold on any date after that, no clock stubbing needed.
const noop = () => {}

function renderDashboard(overrides: Partial<React.ComponentProps<typeof HouseholdDashboard>> = {}) {
  const connector = new FakeFridgeConnector()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <HouseholdDashboard
            userName="Demo"
            onOpenRecettes={noop}
            onOpenCourses={noop}
            onOpenFridge={noop}
            onOpenProduct={noop}
            onAddProduct={noop}
            onScanProduct={noop}
            onScanReceipt={noop}
            onOpenSettings={noop}
            {...overrides}
          />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return connector
}

test('names the real household, not a hardcoded one', async () => {
  renderDashboard()

  await waitFor(() => expect(screen.getByText('Maison Bellevue')).toBeTruthy())
})

test('the hero counts the products actually at risk in the fridge', async () => {
  renderDashboard()

  await waitFor(() => expect(screen.getByText('1 produit à surveiller')).toBeTruthy())
  expect(screen.getByText('1 périmé')).toBeTruthy()
})

test('"À racheter" counts the unchecked shopping items', async () => {
  renderDashboard()

  // Four of the five fake items are unchecked.
  await waitFor(() => expect(screen.getByText('4 articles à prendre')).toBeTruthy())
})

test('a product in the preview opens that product', async () => {
  const onOpenProduct = jest.fn()
  renderDashboard({ onOpenProduct })

  await waitFor(() => expect(screen.getByTestId('dashboard-product-fake-product-1')).toBeTruthy())

  fireEvent.press(screen.getByTestId('dashboard-product-fake-product-1'))

  expect(onOpenProduct).toHaveBeenCalledWith('fake-product-1')
})

test('an empty fridge offers the two ways to fill it instead of a dead sentence', async () => {
  const onAddProduct = jest.fn()
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getProducts').mockResolvedValue([])
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <HouseholdDashboard
            userName="Demo"
            onOpenRecettes={noop}
            onOpenCourses={noop}
            onOpenFridge={noop}
            onOpenProduct={noop}
            onAddProduct={onAddProduct}
            onScanProduct={noop}
            onScanReceipt={noop}
            onOpenSettings={noop}
          />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByText('Ton frigo est encore vide')).toBeTruthy())

  fireEvent.press(screen.getByTestId('dashboard-empty-add'))

  expect(onAddProduct).toHaveBeenCalled()
})
