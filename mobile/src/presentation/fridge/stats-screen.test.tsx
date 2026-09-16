import { render, screen, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { StatsScreen } from './stats-screen.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
}))

function renderStatsScreen(connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <StatsScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('renders the mascot coach card and stat metrics when data is available', async () => {
  renderStatsScreen()

  await waitFor(() => expect(screen.getByText('Statistiques')).toBeTruthy())
  await waitFor(() => expect(screen.getByTestId('stats-consumed-count')).toBeTruthy())

  expect(screen.getByTestId('stats-discarded-count')).toBeTruthy()
  expect(screen.getByTestId('stats-discarded-value')).toBeTruthy()
  expect(screen.getByTestId('stats-trend-chart')).toBeTruthy()
  expect(screen.getByTestId('stats-recipe-share')).toBeTruthy()
})

test('switching periods triggers query update', async () => {
  renderStatsScreen()

  await waitFor(() => expect(screen.getByTestId('stats-period-7')).toBeTruthy())
  fireEvent.press(screen.getByTestId('stats-period-7'))
  await waitFor(() => expect(screen.getByTestId('stats-trend-chart')).toBeTruthy())
})

test('renders the playful empty state when no products have exited', async () => {
  const emptyConnector = new FakeFridgeConnector()
  // `outcomes` is a readonly binding (recordProductOutcome appends to the same
  // array instance), so emptying it means mutating the array in place, not
  // reassigning the property.
  emptyConnector.outcomes.splice(0, emptyConnector.outcomes.length)

  renderStatsScreen(emptyConnector)

  await waitFor(() => expect(screen.getByTestId('stats-empty')).toBeTruthy())
  expect(screen.getByText('Ton frigo fait la sieste 💤')).toBeTruthy()
})
