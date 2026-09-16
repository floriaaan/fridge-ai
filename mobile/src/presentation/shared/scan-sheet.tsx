/**
 * The lime FAB means one thing everywhere: "scan something into the foyer" —
 * it opens the Scanner tab, which is the one screen that offers every scan
 * destination (produit, ticket, frigo). It used to open an action sheet with
 * two of those three choices baked in here a second time; adding "Mon frigo"
 * would have made it three places to keep in sync. One destination, one place.
 */
import { router } from 'expo-router'

/** `.navigate`, not `.push`: on iOS, NativeBottomTabsRouter only special-cases
 * NAVIGATE to jump into another tab's nested stack with params. */
export function goToScan() {
  router.navigate('/(tabs)/scan')
}

export function goToProductScan() {
  router.navigate({ pathname: '/(tabs)/fridge/scan', params: { mode: 'create' } })
}

export function goToReceiptScan() {
  router.navigate('/receipts/scan')
}
