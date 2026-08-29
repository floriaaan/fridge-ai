import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ShoppingItemFormScreen } from './shopping-item-form-screen.js'

function renderWithProviders(children: ReactNode, connector = new FakeFridgeConnector()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>{children}</ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

test('submitting a valid create form calls onSuccess', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<ShoppingItemFormScreen mode="create" onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('shopping-item-form-name'), 'Farine')
  await fireEvent.changeText(screen.getByTestId('shopping-item-form-amount'), '1')
  await fireEvent.changeText(screen.getByTestId('shopping-item-form-unit'), 'kg')
  await fireEvent.press(screen.getByTestId('shopping-item-form-submit'))

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
})

test('an empty name shows an inline error and does not submit', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<ShoppingItemFormScreen mode="create" onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('shopping-item-form-amount'), '1')
  await fireEvent.changeText(screen.getByTestId('shopping-item-form-unit'), 'kg')
  await fireEvent.press(screen.getByTestId('shopping-item-form-submit'))

  await waitFor(() => expect(screen.getByText('Le nom est requis.')).toBeTruthy())
  expect(onSuccess).not.toHaveBeenCalled()
})

test('an invalid quantity shows an inline error and does not submit', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<ShoppingItemFormScreen mode="create" onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('shopping-item-form-name'), 'Farine')
  await fireEvent.changeText(screen.getByTestId('shopping-item-form-amount'), '0')
  await fireEvent.changeText(screen.getByTestId('shopping-item-form-unit'), 'kg')
  await fireEvent.press(screen.getByTestId('shopping-item-form-submit'))

  await waitFor(() => expect(screen.getByText('La quantité doit être un entier supérieur à 0.')).toBeTruthy())
  expect(onSuccess).not.toHaveBeenCalled()
})

test('edit mode pre-fills the form from the cached shopping-items list', async () => {
  const connector = new FakeFridgeConnector()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Prime the cache the same way the list screen would have already done by the time
  // a user reaches the edit route — the form reads from this cache, it does not fetch by id.
  const items = await connector.getShoppingItems()
  queryClient.setQueryData(['shopping-items'], items)

  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ShoppingItemFormScreen mode="edit" itemId="fake-item-1" onSuccess={jest.fn()} />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByTestId('shopping-item-form-name').props.value).toBe('Lait demi-écrémé'))
  expect(screen.getByTestId('shopping-item-form-amount').props.value).toBe('2')
  expect(screen.getByTestId('shopping-item-form-unit').props.value).toBe('L')
})

test('submitting an edit form calls updateShoppingItem with the patched fields', async () => {
  const connector = new FakeFridgeConnector()
  const updateSpy = jest.spyOn(connector, 'updateShoppingItem')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const items = await connector.getShoppingItems()
  queryClient.setQueryData(['shopping-items'], items)
  const onSuccess = jest.fn()

  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ShoppingItemFormScreen mode="edit" itemId="fake-item-1" onSuccess={onSuccess} />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByTestId('shopping-item-form-name').props.value).toBe('Lait demi-écrémé'))
  await fireEvent.changeText(screen.getByTestId('shopping-item-form-amount'), '3')
  await fireEvent.press(screen.getByTestId('shopping-item-form-submit'))

  await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1))
  expect(updateSpy).toHaveBeenCalledWith('fake-item-1', { name: 'Lait demi-écrémé', quantity: { amount: 3, unit: 'L' } })
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
})
