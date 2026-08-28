import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { FridgeFormScreen } from './fridge-form-screen.js'

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
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
  await renderWithProviders(<FridgeFormScreen mode="create" onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('fridge-form-name'), 'Beurre doux')
  await fireEvent.changeText(screen.getByTestId('fridge-form-amount'), '1')
  await fireEvent.changeText(screen.getByTestId('fridge-form-unit'), 'plaquette')
  await fireEvent.changeText(screen.getByTestId('fridge-form-category'), 'Produits laitiers')
  await fireEvent.press(screen.getByTestId('fridge-form-submit'))

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
})

test('an invalid quantity shows an inline error and does not submit', async () => {
  const onSuccess = jest.fn()
  await renderWithProviders(<FridgeFormScreen mode="create" onSuccess={onSuccess} />)

  await fireEvent.changeText(screen.getByTestId('fridge-form-name'), 'Beurre doux')
  await fireEvent.changeText(screen.getByTestId('fridge-form-amount'), '0')
  await fireEvent.changeText(screen.getByTestId('fridge-form-unit'), 'plaquette')
  await fireEvent.changeText(screen.getByTestId('fridge-form-category'), 'Produits laitiers')
  await fireEvent.press(screen.getByTestId('fridge-form-submit'))

  await waitFor(() =>
    expect(screen.getByText('La quantité doit être un entier supérieur à 0.')).toBeTruthy(),
  )
  expect(onSuccess).not.toHaveBeenCalled()
})

test('edit mode pre-fills the form from the existing product', async () => {
  await renderWithProviders(<FridgeFormScreen mode="edit" productId="fake-product-1" onSuccess={jest.fn()} />)

  await waitFor(() => expect(screen.getByTestId('fridge-form-name').props.value).toBe('Lait demi-écrémé'))
  expect(screen.getByTestId('fridge-form-amount').props.value).toBe('1')
  expect(screen.getByTestId('fridge-form-unit').props.value).toBe('L')
})

test('a prefillBarcode found in the lookup fixture pre-fills name/category', async () => {
  await renderWithProviders(
    <FridgeFormScreen mode="create" prefillBarcode="3017620422003" onSuccess={jest.fn()} />,
  )

  await waitFor(() =>
    expect(screen.getByTestId('fridge-form-name').props.value).toBe('Pâte à tartiner noisettes-cacao'),
  )
  expect(screen.getByTestId('fridge-form-category').props.value).toBe('Pâtes à tartiner')
})

test('a prefillBarcode not in the lookup fixture shows an informational hint, leaves the form empty', async () => {
  await renderWithProviders(<FridgeFormScreen mode="create" prefillBarcode="0000000000000" onSuccess={jest.fn()} />)

  await waitFor(() => expect(screen.getByText('Produit non trouvé, remplis les champs à la main.')).toBeTruthy())
  expect(screen.getByTestId('fridge-form-name').props.value).toBe('')
})
