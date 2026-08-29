import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { SettingsScreen } from './settings-screen.js'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={new FakeFridgeConnector()}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('shows only the available providers with the active one selected, plus the source', async () => {
  await renderWithProviders(<SettingsScreen />)

  await waitFor(() => expect(screen.getByTestId('ai-provider-gemini')).toBeTruthy())
  expect(screen.queryByTestId('ai-provider-ollama')).toBeNull()
  expect(screen.getByTestId('ai-provider-gemini').props.accessibilityState.selected).toBe(true)
  expect(screen.getByText("Configuré par l'administrateur")).toBeTruthy()
})

test('tapping an unselected provider switches the active one', async () => {
  await renderWithProviders(<SettingsScreen />)

  await waitFor(() => expect(screen.getByTestId('ai-provider-openai')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('ai-provider-openai'))

  await waitFor(() => expect(screen.getByTestId('ai-provider-openai').props.accessibilityState.selected).toBe(true))
})

test('has a link to the receipt history', async () => {
  await renderWithProviders(<SettingsScreen />)

  await waitFor(() => expect(screen.getByTestId('settings-receipts-history')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('settings-receipts-history'))

  expect(router.push).toHaveBeenCalledWith('/(tabs)/receipts')
})
