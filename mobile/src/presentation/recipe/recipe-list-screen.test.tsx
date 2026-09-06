import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { RecipeListScreen } from './recipe-list-screen.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn() },
  useFocusEffect: jest.fn(),
}))

function renderList(connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <RecipeListScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return connector
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('a recipe card opens that recipe instead of a "bientôt disponible" toast', async () => {
  renderList()

  await waitFor(() => expect(screen.getByText('Poêlée poulet-épinards')).toBeTruthy())

  fireEvent.press(screen.getByText('Poêlée poulet-épinards'))

  expect(router.push).toHaveBeenCalledWith({ pathname: '/(tabs)/recipes/[id]', params: { id: 'fake-recipe-1' } })
})

test('the generate card opens the composer sheet rather than firing a request', async () => {
  renderList()

  await waitFor(() => expect(screen.getByTestId('recipes-generate')).toBeTruthy())

  fireEvent.press(screen.getByTestId('recipes-generate'))

  expect(router.push).toHaveBeenCalledWith('/(tabs)/recipes/generate')
})

test('the generate card names the products it will cook from', async () => {
  renderList()

  await waitFor(() => expect(screen.getByText(/^À partir de : /)).toBeTruthy())
})
