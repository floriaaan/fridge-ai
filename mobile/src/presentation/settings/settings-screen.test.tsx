import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { SettingsScreen } from './settings-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useFocusEffect: jest.fn() }))

async function renderAuthenticated(connector = new FakeFridgeConnector()) {
  // Signed out by default (see fake-fridge-connector.ts) — the account
  // card needs a real session to show a real name/email.
  await connector.signInSocial()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <SettingsScreen />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('shows the signed-in user and the household on their own cards', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByText('Demo User')).toBeTruthy())
  expect(screen.getByText('demo@example.com')).toBeTruthy()
})

test('the foyer card carries the whole width, its members and the role — not a truncated name', async () => {
  await renderAuthenticated()

  // The name, not the testID: the card renders straight away with a "—"
  // placeholder while the household query is in flight.
  await waitFor(() => expect(screen.getByText('Maison Bellevue')).toBeTruthy())

  expect(screen.getByText('2 membres')).toBeTruthy()
  expect(screen.getByText('Propriétaire')).toBeTruthy()
  // Initials, one per member, from the two fixture names.
  expect(screen.getByText('DU')).toBeTruthy()
  expect(screen.getByText('C')).toBeTruthy()

  fireEvent.press(screen.getByTestId('settings-household'))

  expect(router.push).toHaveBeenCalledWith('/household')
})

test('shows only the available providers with the active one selected, and says what the choice drives', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('ai-provider-gemini')).toBeTruthy())
  expect(screen.queryByTestId('ai-provider-ollama')).toBeNull()
  expect(screen.getByTestId('ai-provider-gemini').props.accessibilityState.selected).toBe(true)
  expect(screen.getByText('Lit tes tickets de caisse et invente tes recettes.')).toBeTruthy()
})

test('never claims the administrator locked a choice the foyer can in fact make', async () => {
  await renderAuthenticated()

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
    .mockResolvedValue({ activeProvider: 'gemini', source: 'environment', availableProviders: ['gemini'] })

  await renderAuthenticated(connector)

  await waitFor(() => expect(screen.getByText('Gemini')).toBeTruthy())
  expect(screen.queryByTestId('ai-provider-gemini')).toBeNull()
})

test('a server with no provider configured says so instead of showing an empty row', async () => {
  const connector = new FakeFridgeConnector()
  jest
    .spyOn(connector, 'getAiSettings')
    .mockResolvedValue({ activeProvider: 'gemini', source: 'environment', availableProviders: [] })

  await renderAuthenticated(connector)

  await waitFor(() => expect(screen.getByText('Aucun fournisseur n’est configuré sur ce serveur.')).toBeTruthy())
})

test('tapping an unselected provider switches the active one', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('ai-provider-openai')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('ai-provider-openai'))

  await waitFor(() => expect(screen.getByTestId('ai-provider-openai').props.accessibilityState.selected).toBe(true))
})

test('does not file the receipt history under settings — it is content, and it lives on the dashboard now', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('sign-out')).toBeTruthy())

  expect(screen.queryByTestId('settings-receipts-history')).toBeNull()
  expect(screen.queryByText('Historique des tickets')).toBeNull()
})

test('signing out clears the session and returns to sign-in', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('sign-out')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('sign-out'))

  // Confirmed, like every other consequential action — a shared kitchen tablet
  // is the scene a bare sign-out button fails in.
  await waitFor(() => expect(screen.getByTestId('sign-out-confirm')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('sign-out-confirm'))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/sign-in'))
})

test('a foyer that could not be read is unavailable, not absent', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'getHousehold').mockRejectedValue(new Error('network'))

  await renderAuthenticated(connector)

  await waitFor(() => expect(screen.getByText('Foyer indisponible')).toBeTruthy())
  // "Aucun foyer" is a fact about the account; a failed read is a fact about
  // the network. Printing the first for the second invents a state.
  expect(screen.queryByText('Aucun foyer')).toBeNull()
})

// The Home Assistant entry point moved to /household (see
// household-screen.test.tsx) — it's a foyer-scoped setting, not an
// account-scoped one, so it lives on the Foyer page next to invite/members
// rather than on Réglages.
