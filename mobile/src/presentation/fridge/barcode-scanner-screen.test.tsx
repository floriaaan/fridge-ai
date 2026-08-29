import { act, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { ThemeProvider } from '../shared/theme-provider.js'
import { BarcodeScannerScreen } from './barcode-scanner-screen.js'

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}))

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))

test('scanning a barcode in create mode navigates to the new-product form with prefillBarcode', async () => {
  await render(
    <ThemeProvider>
      <BarcodeScannerScreen mode="create" />
    </ThemeProvider>,
  )

  // NOTE: the brief's own test used `screen.UNSAFE_getByType('CameraView')`,
  // but this repo has @testing-library/react-native ^14 installed, which
  // removed the legacy UNSAFE_getByType/UNSAFE_getByProps queries entirely
  // (see its migration-v14 doc). testID + getByTestId is the v14-supported
  // equivalent for reaching into the mocked host element's props.
  const camera = screen.getByTestId('fridge-barcode-camera')
  await act(async () => {
    camera.props.onBarcodeScanned({ data: '3017620422003' })
  })

  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/(tabs)/fridge/new',
    params: { prefillBarcode: '3017620422003' },
  })
})

test('scanning a barcode in edit mode navigates to that product\'s edit form with prefillBarcode', async () => {
  await render(
    <ThemeProvider>
      <BarcodeScannerScreen mode="edit" productId="fake-product-1" />
    </ThemeProvider>,
  )

  const camera = screen.getByTestId('fridge-barcode-camera')
  await act(async () => {
    camera.props.onBarcodeScanned({ data: '3017620422003' })
  })

  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/(tabs)/fridge/[id]/edit',
    params: { id: 'fake-product-1', prefillBarcode: '3017620422003' },
  })
})
