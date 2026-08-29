import { act, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import { ThemeProvider } from '../shared/theme-provider.js'
import { BarcodeScannerScreen } from './barcode-scanner-screen.js'

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}))

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn(), setParams: jest.fn() } }))

beforeEach(() => {
  jest.clearAllMocks()
})

test('scanning a barcode in create mode with no form open navigates to the new-product form with prefillBarcode', async () => {
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

test("scanning a barcode in edit mode with no form open navigates to that product's edit form with prefillBarcode", async () => {
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

test('scanning a barcode launched from an already-open form dismisses back onto it instead of opening a new one', async () => {
  await render(
    <ThemeProvider>
      <BarcodeScannerScreen mode="create" fromForm />
    </ThemeProvider>,
  )

  const camera = screen.getByTestId('fridge-barcode-camera')
  await act(async () => {
    camera.props.onBarcodeScanned({ data: '3017620422003' })
  })

  expect(router.back).toHaveBeenCalledTimes(1)
  expect(router.setParams).toHaveBeenCalledWith({ prefillBarcode: '3017620422003' })
  expect(router.replace).not.toHaveBeenCalled()
})

test('scanning a barcode launched from an already-open edit form also dismisses back onto it', async () => {
  await render(
    <ThemeProvider>
      <BarcodeScannerScreen mode="edit" productId="fake-product-1" fromForm />
    </ThemeProvider>,
  )

  const camera = screen.getByTestId('fridge-barcode-camera')
  await act(async () => {
    camera.props.onBarcodeScanned({ data: '3017620422003' })
  })

  expect(router.back).toHaveBeenCalledTimes(1)
  expect(router.setParams).toHaveBeenCalledWith({ prefillBarcode: '3017620422003' })
  expect(router.replace).not.toHaveBeenCalled()
})

test('multiple rapid onBarcodeScanned callbacks only navigate once', async () => {
  await render(
    <ThemeProvider>
      <BarcodeScannerScreen mode="create" />
    </ThemeProvider>,
  )

  const camera = screen.getByTestId('fridge-barcode-camera')
  await act(async () => {
    camera.props.onBarcodeScanned({ data: '3017620422003' })
    camera.props.onBarcodeScanned({ data: '3017620422003' })
    camera.props.onBarcodeScanned({ data: '0000000000000' })
  })

  expect(router.replace).toHaveBeenCalledTimes(1)
})
