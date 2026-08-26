import { Redirect, Stack } from 'expo-router'
import { useSessionQuery } from '../../application/identity/session.query.js'

export default function AuthLayout() {
  const session = useSessionQuery()

  if (session.isPending) return null
  if (session.data) return <Redirect href="/(tabs)" />

  return <Stack screenOptions={{ headerShown: false }} />
}
