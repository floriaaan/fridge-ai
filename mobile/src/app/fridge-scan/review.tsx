import { useMemo } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { FridgeScanReviewScreen } from '../../presentation/fridge/fridge-scan-review-screen.js'

export default function FridgeScanReviewRoute() {
  const { imageUris } = useLocalSearchParams<{ imageUris: string }>()
  // Parsed once per param value, not per render: `useFridgeScan` keys its callbacks on this array.
  const uris = useMemo(() => JSON.parse(imageUris) as string[], [imageUris])
  return <FridgeScanReviewScreen imageUris={uris} />
}
