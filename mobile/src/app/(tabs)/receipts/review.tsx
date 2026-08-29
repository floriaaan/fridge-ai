import { useLocalSearchParams } from 'expo-router'
import { ReceiptReviewScreen } from '../../../presentation/receipt/receipt-review-screen.js'

export default function ReceiptReviewRoute() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>()
  return <ReceiptReviewScreen imageUri={imageUri} />
}
