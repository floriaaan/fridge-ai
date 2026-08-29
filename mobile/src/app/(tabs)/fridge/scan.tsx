import { useLocalSearchParams } from 'expo-router'
import { BarcodeScannerScreen } from '../../../presentation/fridge/barcode-scanner-screen.js'

export default function FridgeScanRoute() {
  const { mode, productId } = useLocalSearchParams<{ mode: 'create' | 'edit'; productId?: string }>()
  if (mode === 'edit' && productId) return <BarcodeScannerScreen mode="edit" productId={productId} />
  return <BarcodeScannerScreen mode="create" />
}
