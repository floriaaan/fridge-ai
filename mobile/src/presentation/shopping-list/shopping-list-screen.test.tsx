import { render, screen, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ShoppingListScreen } from './shopping-list-screen.js'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}))

function renderScreen(connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ShoppingListScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

afterEach(() => jest.clearAllMocks())

test('tapping "+ Ajouter" navigates to the new-item route', async () => {
  await renderScreen()
  await fireEvent.press(screen.getByTestId('shopping-list-add'))
  expect(router.push).toHaveBeenCalledWith('/(tabs)/shopping-list/new')
})
