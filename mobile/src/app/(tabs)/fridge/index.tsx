import { router, useLocalSearchParams } from 'expo-router'
import { FridgeListScreen } from '../../../presentation/fridge/fridge-list-screen.js'
import { parseExpiryWindow } from '../../../presentation/dashboard/product-status.js'

/**
 * `?status=week|expired` — how the dashboard's stat cards open the cabinet on
 * what they just counted. The route owns the parameter and clears it by
 * writing the URL, so the screen below stays a pure function of its props and
 * a second tap from the dashboard actually re-filters an already-mounted list.
 */
export default function FridgeIndexRoute() {
  const { status } = useLocalSearchParams<{ status?: string }>()

  return (
    <FridgeListScreen
      expiryWindow={parseExpiryWindow(status)}
      onExpiryWindowChange={(window) => router.setParams({ status: window ?? undefined })}
    />
  )
}
