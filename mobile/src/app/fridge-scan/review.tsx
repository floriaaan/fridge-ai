import { useLocalSearchParams } from 'expo-router'
import { FridgeScanReviewScreen } from '../../presentation/fridge/fridge-scan-review-screen.js'

export default function FridgeScanReviewRoute() {
  const { imageUris } = useLocalSearchParams<{ imageUris: string }>()
  return <FridgeScanReviewScreen imageUris={JSON.parse(imageUris) as string[]} />
}
