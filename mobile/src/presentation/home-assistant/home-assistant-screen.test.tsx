import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { HomeAssistantScreen } from './home-assistant-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useFocusEffect: jest.fn() }))

function renderScreen(connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <HomeAssistantScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('an unconfigured foyer starts on the connection form', async () => {
  renderScreen()
  await waitFor(() => expect(screen.getByPlaceholderText(/adresse/i)).toBeTruthy())
  expect(screen.queryByText('Rechercher une liste')).toBeNull()
})

test('testing the connection reveals the list picker', async () => {
  renderScreen()
  await waitFor(() => expect(screen.getByPlaceholderText(/adresse/i)).toBeTruthy())
  fireEvent.changeText(screen.getByPlaceholderText(/adresse/i), 'http://homeassistant.local:8123')
  fireEvent.changeText(screen.getByPlaceholderText(/jeton/i), 'a-token')
  fireEvent.press(screen.getByText('Tester la connexion'))
  await waitFor(() => expect(screen.getByPlaceholderText('Rechercher une liste')).toBeTruthy())
  expect(screen.getByText('Courses')).toBeTruthy() // from the fake's discoverHaTodoEntities()
})

test('picking a list and saving calls bindHaList and pops the screen', async () => {
  renderScreen()
  await waitFor(() => expect(screen.getByPlaceholderText(/adresse/i)).toBeTruthy())
  fireEvent.changeText(screen.getByPlaceholderText(/adresse/i), 'http://homeassistant.local:8123')
  fireEvent.changeText(screen.getByPlaceholderText(/jeton/i), 'a-token')
  fireEvent.press(screen.getByText('Tester la connexion'))
  await waitFor(() => expect(screen.getByText('Courses')).toBeTruthy())
  fireEvent.press(screen.getByText('Courses'))
  fireEvent.press(screen.getByText('Enregistrer'))
  await waitFor(() => expect(router.back).toHaveBeenCalled())
})

test('the direction chips default to "Deux sens" and switch on tap', async () => {
  renderScreen()
  await waitFor(() => expect(screen.getByPlaceholderText(/adresse/i)).toBeTruthy())
  fireEvent.changeText(screen.getByPlaceholderText(/adresse/i), 'http://homeassistant.local:8123')
  fireEvent.changeText(screen.getByPlaceholderText(/jeton/i), 'a-token')
  fireEvent.press(screen.getByText('Tester la connexion'))
  await waitFor(() => expect(screen.getByText('Deux sens')).toBeTruthy())
  fireEvent.press(screen.getByText('Vers Home Assistant'))
  expect(screen.getByText(/Home Assistant reflète cette liste/)).toBeTruthy()
})
