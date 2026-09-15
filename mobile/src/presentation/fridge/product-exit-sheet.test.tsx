import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ProductExitSheet } from './product-exit-sheet.js'
import { fakeProducts } from '../../infrastructure/fake/fixtures/product.fixture.js'

const lait = fakeProducts.find((p) => p.id === 'fake-product-1')!
const jambon = fakeProducts.find((p) => p.id === 'fake-product-6')! // 4 tranches, date passed

async function renderSheet(products = [lait]) {
  const handlers = { onClose: jest.fn(), onConsumed: jest.fn(), onDiscarded: jest.fn(), onCorrection: jest.fn() }
  await render(
    <ThemeProvider>
      <ProductExitSheet visible products={products} {...handlers} />
    </ThemeProvider>,
  )
  return handlers
}

test('names the product and offers eaten, thrown away, and a quiet correction', async () => {
  await renderSheet()
  await waitFor(() => expect(screen.getByText('Retirer « Lait demi-écrémé » ?')).toBeTruthy())
  expect(screen.getByTestId('product-exit-consumed')).toBeTruthy()
  expect(screen.getByTestId('product-exit-discarded')).toBeTruthy()
  expect(screen.getByTestId('product-exit-correction')).toBeTruthy()
})

test('eaten and correction answer at once', async () => {
  const handlers = await renderSheet()
  await waitFor(() => expect(screen.getByTestId('product-exit-consumed')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('product-exit-consumed'))
  expect(handlers.onConsumed).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByTestId('product-exit-correction'))
  expect(handlers.onCorrection).toHaveBeenCalledTimes(1)
})

test('thrown away asks why, and nothing is required', async () => {
  const handlers = await renderSheet()
  await waitFor(() => expect(screen.getByTestId('product-exit-discarded')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('product-exit-discarded'))
  await waitFor(() => expect(screen.getByText('Jeter « Lait demi-écrémé » ?')).toBeTruthy())
  // One unit: no amount to choose.
  expect(screen.queryByTestId('product-exit-amount-value')).toBeNull()

  await fireEvent.press(screen.getByTestId('product-exit-discard-confirm'))
  expect(handlers.onDiscarded).toHaveBeenCalledWith({ discardReason: null, amount: null })
})

test('a product past its date comes with "Dépassé" already picked, and the amount defaults to all of it', async () => {
  const handlers = await renderSheet([jambon])
  await waitFor(() => expect(screen.getByTestId('product-exit-discarded')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('product-exit-discarded'))

  await waitFor(() => expect(screen.getByTestId('product-exit-amount-value')).toBeTruthy())
  expect(screen.getByTestId('product-exit-reason-expired').props.accessibilityState).toMatchObject({ selected: true })
  expect(screen.getByTestId('product-exit-amount-value')).toHaveTextContent('4 tranches')

  await fireEvent.press(screen.getByTestId('product-exit-amount-decrease'))
  await fireEvent.press(screen.getByTestId('product-exit-reason-spoiled'))
  await fireEvent.press(screen.getByTestId('product-exit-discard-confirm'))

  expect(handlers.onDiscarded).toHaveBeenCalledWith({ discardReason: 'spoiled', amount: 3 })
})

test('the amount never goes below one or above the stock', async () => {
  await renderSheet([jambon])
  await waitFor(() => expect(screen.getByTestId('product-exit-discarded')).toBeTruthy())
  await fireEvent.press(screen.getByTestId('product-exit-discarded'))
  await waitFor(() => expect(screen.getByTestId('product-exit-amount-value')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('product-exit-amount-increase'))
  expect(screen.getByTestId('product-exit-amount-value')).toHaveTextContent('4 tranches')
  for (let i = 0; i < 5; i++) await fireEvent.press(screen.getByTestId('product-exit-amount-decrease'))
  expect(screen.getByTestId('product-exit-amount-value')).toHaveTextContent('1 tranches')
})

test('several products: plural wording, and no amount to pick', async () => {
  const handlers = await renderSheet([lait, jambon])
  await waitFor(() => expect(screen.getByText('Retirer 2 produits ?')).toBeTruthy())

  await fireEvent.press(screen.getByTestId('product-exit-discarded'))
  await waitFor(() => expect(screen.getByText('Jeter 2 produits ?')).toBeTruthy())
  expect(screen.queryByTestId('product-exit-amount-value')).toBeNull()
  // Only one of the two is past its date: nothing is guessed.
  expect(screen.getByTestId('product-exit-reason-expired').props.accessibilityState).toMatchObject({
    selected: false,
  })

  await fireEvent.press(screen.getByTestId('product-exit-discard-confirm'))
  expect(handlers.onDiscarded).toHaveBeenCalledWith({ discardReason: null, amount: null })
})
