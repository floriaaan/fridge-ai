import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { SettingsScreen } from './settings-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useFocusEffect: jest.fn() }))

async function renderAuthenticated() {
  const connector = new FakeFridgeConnector()
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

test('shows only the available providers with the active one selected, plus the source', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('ai-provider-gemini')).toBeTruthy())
  expect(screen.queryByTestId('ai-provider-ollama')).toBeNull()
  expect(screen.getByTestId('ai-provider-gemini').props.accessibilityState.selected).toBe(true)
  expect(screen.getByText("Configuré par l'administrateur")).toBeTruthy()
})

test('tapping an unselected provider switches the active one', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('ai-provider-openai')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('ai-provider-openai'))

  await waitFor(() => expect(screen.getByTestId('ai-provider-openai').props.accessibilityState.selected).toBe(true))
})

test('has a link to the receipt history', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('settings-receipts-history')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('settings-receipts-history'))

  expect(router.push).toHaveBeenCalledWith('/(tabs)/receipts')
})

test('signing out clears the session and returns to sign-in', async () => {
  await renderAuthenticated()

  await waitFor(() => expect(screen.getByTestId('sign-out')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('sign-out'))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/sign-in'))
})
