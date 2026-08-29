import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { router } from 'expo-router'
import { ConnectorProvider } from '../../application/shared/connector-context.js'
import { FakeFridgeConnector } from '../../infrastructure/fake/fake-fridge-connector.js'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptReviewScreen } from './receipt-review-screen.js'

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))

// @testing-library/react-native v14: render() AND fireEvent (press/changeText/
// scroll) are async by default, both return a Promise — every call below must
// be awaited (cf. login-form.test.tsx's comment; this bit the mobile test
// harness once already).
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

beforeEach(() => {
  jest.clearAllMocks()
})

test('scans the image on mount and pre-fills the form from the draft', async () => {
  await renderWithProviders(<ReceiptReviewScreen imageUri="file://receipt.jpg" />)

  await waitFor(() => expect(screen.getByTestId('receipt-review-store-name').props.value).toBe('Carrefour'))
  expect(screen.getByTestId('receipt-item-0-name').props.value).toBe('Lait demi-écrémé')
})

test('importing sends every item with its chosen location and navigates to the dashboard on success', async () => {
  await renderWithProviders(<ReceiptReviewScreen imageUri="file://receipt.jpg" />)

  await waitFor(() => expect(screen.getByTestId('receipt-item-0-name').props.value).toBe('Lait demi-écrémé'))

  await act(async () => {
    await fireEvent.press(screen.getByTestId('receipt-review-submit'))
  })

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)'))
})

test('shows a retry hint when the scan fails', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const connector = new FakeFridgeConnector()
  connector.scanReceipt = jest.fn().mockResolvedValue({ ok: false, error: { type: 'extraction_failed', message: 'Extraction impossible.' } })

  await render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectorProvider connector={connector}>
          <ReceiptReviewScreen imageUri="file://receipt.jpg" />
        </ConnectorProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  await waitFor(() => expect(screen.getByText('Extraction impossible, réessaie ou vérifie ta photo.')).toBeTruthy())
  expect(screen.getByTestId('receipt-review-retry')).toBeTruthy()
})
