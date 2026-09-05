import { router } from 'expo-router'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { HouseholdDashboard } from '../../presentation/dashboard/household-dashboard.js'

export default function HomeScreen() {
  const session = useSessionQuery()

  return (
    <HouseholdDashboard
      userName={session.data?.user.name ?? ''}
      onOpenRecettes={() => router.push('/(tabs)/recipes')}
      onOpenCourses={() => router.push('/(tabs)/shopping-list')}
      onOpenFridge={() => router.push('/(tabs)/fridge')}
      onOpenProduct={(productId) => router.navigate({ pathname: '/(tabs)/fridge/[id]', params: { id: productId } })}
      onAddProduct={() => router.navigate('/(tabs)/fridge/new')}
      // `.navigate`, not `.push`: on iOS, NativeBottomTabsRouter only special-cases the
      // NAVIGATE action to jump into another tab's nested stack with params — PUSH from
      // outside that tab either drops the nested screen (lands on Frigo's root) or, for
      // an un-triggered route like receipts, does nothing at all.
      onScanProduct={() => router.navigate({ pathname: '/(tabs)/fridge/scan', params: { mode: 'create' } })}
      onScanReceipt={() => router.navigate('/(tabs)/receipts/scan')}
      onOpenSettings={() => router.push('/(tabs)/settings')}
    />
  )
}
