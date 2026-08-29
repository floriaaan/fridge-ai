import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { ThemeProvider } from '../shared/theme-provider.js'
import { ReceiptScannerScreen } from './receipt-scanner-screen.js'

const mockTakePictureAsync = jest.fn()
const mockLaunchImageLibraryAsync = jest.fn()

jest.mock('expo-camera', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports
  const React = require('react')
  const MockCameraView = React.forwardRef((props: { testID?: string }, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePictureAsync }))
    return React.createElement('CameraView', { testID: props.testID })
  })
  MockCameraView.displayName = 'MockCameraView'
  return {
    CameraView: MockCameraView,
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
  }
})

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
  MediaTypeOptions: { Images: 'Images' },
}))

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn() } }))

beforeEach(() => {
  jest.clearAllMocks()
})

test('capturing a photo navigates to the review screen with its uri', async () => {
  mockTakePictureAsync.mockResolvedValue({ uri: 'file://receipt.jpg' })
  await render(
    <ThemeProvider>
      <ReceiptScannerScreen />
    </ThemeProvider>,
  )

  await act(async () => {
    fireEvent.press(screen.getByTestId('receipt-scanner-capture'))
  })

  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/(tabs)/receipts/review',
    params: { imageUri: 'file://receipt.jpg' },
  })
})

test('picking a photo from the gallery navigates to the review screen with its uri', async () => {
  mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://gallery.jpg' }] })
  await render(
    <ThemeProvider>
      <ReceiptScannerScreen />
    </ThemeProvider>,
  )

  await act(async () => {
    fireEvent.press(screen.getByTestId('receipt-scanner-gallery'))
  })

  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/(tabs)/receipts/review',
    params: { imageUri: 'file://gallery.jpg' },
  })
})

test('canceling the gallery picker does not navigate', async () => {
  mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null })
  await render(
    <ThemeProvider>
      <ReceiptScannerScreen />
    </ThemeProvider>,
  )

  await act(async () => {
    fireEvent.press(screen.getByTestId('receipt-scanner-gallery'))
  })

  expect(router.replace).not.toHaveBeenCalled()
})
