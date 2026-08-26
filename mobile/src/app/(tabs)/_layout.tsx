import { Redirect, Tabs } from 'expo-router'
import { useSessionQuery } from '../../application/identity/session.query.js'

export default function TabsLayout() {
  const session = useSessionQuery()

  if (session.isPending) return null
  if (!session.data) return <Redirect href="/(auth)/sign-in" />

  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
    </Tabs>
  )
}
