import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
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

test('swiping and tapping "Modifier" navigates to the item\'s edit route', async () => {
  await renderScreen()
  const editButtons = await screen.findAllByTestId(/^shopping-row-edit-/)
  await fireEvent.press(editButtons[0])
  expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/(tabs)/shopping-list/[id]/edit' }))
})

test('swiping and tapping "Supprimer" deletes the item and refreshes the list', async () => {
  const connector = new FakeFridgeConnector()
  const deleteSpy = jest.spyOn(connector, 'deleteShoppingItem')
  await renderScreen(connector)

  const before = await screen.findAllByTestId(/^shopping-row-delete-/)
  const targetTestId = before[0].props.testID as string
  await fireEvent.press(before[0])

  await waitFor(() => expect(deleteSpy).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.queryByTestId(targetTestId)).toBeNull())
})

test('a failed delete shows a hint instead of removing the row', async () => {
  const connector = new FakeFridgeConnector()
  jest.spyOn(connector, 'deleteShoppingItem').mockResolvedValue({ ok: false, error: { type: 'server_error', message: 'Suppression impossible.' } })
  await renderScreen(connector)

  const deleteButtons = await screen.findAllByTestId(/^shopping-row-delete-/)
  await fireEvent.press(deleteButtons[0])

  await waitFor(() => expect(screen.getByText('Suppression impossible.')).toBeTruthy())
})
