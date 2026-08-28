import { useLocalSearchParams } from 'expo-router'
import { FridgeFormScreen } from '../../../../presentation/fridge/fridge-form-screen.js'

export default function FridgeEditRoute() {
  const { id, prefillBarcode } = useLocalSearchParams<{ id: string; prefillBarcode?: string }>()
  return <FridgeFormScreen mode="edit" productId={id} prefillBarcode={prefillBarcode} />
}
