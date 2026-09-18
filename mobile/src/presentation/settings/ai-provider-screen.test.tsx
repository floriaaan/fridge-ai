import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { AiProviderScreen } from './ai-provider-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useFocusEffect: jest.fn() }))

async function renderScreen(connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <AiProviderScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('shows only the available providers with the active one selected, and says what the choice drives', async () => {
  await renderScreen()

  await waitFor(() => expect(screen.getByTestId('ai-provider-gemini')).toBeTruthy())
  expect(screen.queryByTestId('ai-provider-ollama')).toBeNull()
  expect(screen.getByTestId('ai-provider-gemini').props.accessibilityState.selected).toBe(true)
  expect(screen.getByText('Lit tes tickets de caisse et invente tes recettes.')).toBeTruthy()
})

test('never claims the administrator locked a choice the foyer can in fact make', async () => {
  await renderScreen()

  await waitFor(() => expect(screen.getByTestId('ai-provider-gemini')).toBeTruthy())
  // `source` only records whether anyone has picked yet — the stored row always
  // wins over the env default, so the old wording described a lock that isn't there.
  expect(screen.queryByText("Configuré par l'administrateur")).toBeNull()
  expect(screen.queryByText('Choisi par le foyer')).toBeNull()
})

test('a single available provider is stated, not offered as a choice of one', async () => {
  const connector = new FakeFridgeConnector()
  jest
    .spyOn(connector, 'getAiSettings')
    .mockResolvedValue({
      activeProvider: 'gemini',
      source: 'environment',
      availableProviders: ['gemini'],
      lockedProviders: [],
      models: { vision: 'gemini-2.5-flash', text: 'gemini-2.5-flash' },
    })

  await renderScreen(connector)

  await waitFor(() => expect(screen.getByTestId('settings-ai-models')).toBeTruthy())
  expect(screen.queryByTestId('ai-provider-gemini')).toBeNull()
})

test('a server with no provider configured says so instead of showing an empty row', async () => {
  const connector = new FakeFridgeConnector()
  jest
    .spyOn(connector, 'getAiSettings')
    .mockResolvedValue({
      activeProvider: 'gemini',
      source: 'environment',
      availableProviders: [],
      lockedProviders: [],
      models: { vision: '', text: '' },
    })

  await renderScreen(connector)

  await waitFor(() => expect(screen.getByText('Aucun fournisseur n’est configuré sur ce serveur.')).toBeTruthy())
})

test('tapping an unselected provider switches the active one', async () => {
  await renderScreen()

  await waitFor(() => expect(screen.getByTestId('ai-provider-openai')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('ai-provider-openai'))

  await waitFor(() => expect(screen.getByTestId('ai-provider-openai').props.accessibilityState.selected).toBe(true))
})

test('a paywalled provider is shown locked, not hidden, and says why it cannot be picked', async () => {
  const connector = new FakeFridgeConnector()
  jest
    .spyOn(connector, 'getAiSettings')
    .mockResolvedValue({
      activeProvider: 'ollama',
      source: 'database',
      availableProviders: ['ollama'],
      lockedProviders: ['gemini'],
      models: { vision: 'llava', text: 'llama3.1' },
    })

  await renderScreen(connector)

  await waitFor(() => expect(screen.getByTestId('ai-provider-gemini')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('ai-provider-gemini'))

  await waitFor(() => expect(screen.getByText('Gemini nécessite un abonnement actif.')).toBeTruthy())
  expect(screen.getByTestId('ai-provider-ollama').props.accessibilityState.selected).toBe(true)
})
