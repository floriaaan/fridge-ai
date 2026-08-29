import { useLocalSearchParams } from 'expo-router'
import { BarcodeScannerScreen } from '../../../presentation/fridge/barcode-scanner-screen.js'

export default function FridgeScanRoute() {
  const { mode, productId, fromForm } = useLocalSearchParams<{
    mode: 'create' | 'edit'
    productId?: string
    fromForm?: string
  }>()
  if (mode === 'edit' && productId) {
    return <BarcodeScannerScreen mode="edit" productId={productId} fromForm={fromForm === '1'} />
  }
  return <BarcodeScannerScreen mode="create" fromForm={fromForm === '1'} />
}
