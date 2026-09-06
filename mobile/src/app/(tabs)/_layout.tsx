import { Platform } from 'react-native'
import { Redirect, Tabs } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useSessionQuery } from '../../application/identity/session.query.js'

/**
 * iOS: real `NativeTabs` — Liquid Glass on iOS 26+, standard native bar
 * below that. The `scan` trigger uses `role="search"`, which iOS renders
 * as a separate, floating pill on the trailing edge of the bar — see
 * `(tabs)/scan.tsx` for why it's a route rather than a plain button.
 */
function IosTabs() {
  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="fridge">
        <NativeTabs.Trigger.Icon sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }} />
        <NativeTabs.Trigger.Label>Garde-manger</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recipes">
        <NativeTabs.Trigger.Icon sf="fork.knife" />
        <NativeTabs.Trigger.Label>Recettes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shopping-list">
        <NativeTabs.Trigger.Icon sf={{ default: 'cart', selected: 'cart.fill' }} />
        <NativeTabs.Trigger.Label>Courses</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan" role="search">
        <NativeTabs.Trigger.Icon sf="barcode.viewfinder" />
        <NativeTabs.Trigger.Label>Scanner</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

/** Android/web: unchanged — hidden native bar, AppShell draws its own BlurView pill instead. */
function DefaultTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
      <Tabs.Screen name="fridge" options={{ title: 'Garde-manger' }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recettes' }} />
      <Tabs.Screen name="shopping-list" options={{ title: 'Liste de courses' }} />
    </Tabs>
  )
}

export default function TabsLayout() {
  const session = useSessionQuery()

  if (session.isPending) return null
  if (!session.data) return <Redirect href="/(auth)/sign-in" />

  return Platform.OS === 'ios' ? <IosTabs /> : <DefaultTabs />
}
