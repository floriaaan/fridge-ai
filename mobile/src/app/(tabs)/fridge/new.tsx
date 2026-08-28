import { useLocalSearchParams } from 'expo-router'
import { FridgeFormScreen } from '../../../presentation/fridge/fridge-form-screen.js'

export default function FridgeNewRoute() {
  const { prefillBarcode } = useLocalSearchParams<{ prefillBarcode?: string }>()
  return <FridgeFormScreen mode="create" prefillBarcode={prefillBarcode} />
}
