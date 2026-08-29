import { router } from 'expo-router'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useSignOutMutation } from '../../application/identity/sign-out.mutation.js'
import { HouseholdDashboard } from '../../presentation/dashboard/household-dashboard.js'

export default function HomeScreen() {
  const session = useSessionQuery()
  const signOut = useSignOutMutation()

  async function handleSignOut() {
    try {
      await signOut.mutateAsync(undefined)
    } catch {
      return
    }
    await session.refetch()
    router.replace('/(auth)/sign-in')
  }

  const error = signOut.error ? 'Une erreur est survenue lors de la déconnexion.' : null

  return (
    <HouseholdDashboard
      userName={session.data?.user.name ?? ''}
      onSignOut={handleSignOut}
      signOutError={error}
      onOpenRecettes={() => router.push('/(tabs)/recipes')}
      onOpenCourses={() => router.push('/(tabs)/shopping-list')}
      onOpenFridge={() => router.push('/(tabs)/fridge')}
      onScanProduct={() => router.push({ pathname: '/(tabs)/fridge/scan', params: { mode: 'create' } })}
    />
  )
}
