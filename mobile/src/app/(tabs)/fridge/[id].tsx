import { useLocalSearchParams } from 'expo-router'
import { FridgeDetailScreen } from '../../../presentation/fridge/fridge-detail-screen.js'

export default function FridgeDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <FridgeDetailScreen productId={id} />
}
