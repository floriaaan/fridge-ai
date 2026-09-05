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
      onOpenSettings={() => router.push('/(tabs)/settings')}
    />
  )
}
