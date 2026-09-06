import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ThemeProvider } from '../presentation/shared/theme-provider.js'
import { ConnectorProvider } from '../application/shared/connector-context.js'
import { createConnector } from '../../providers/create-connector.js'

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient())
  const [connector] = useState(() => createConnector())

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ConnectorProvider connector={connector}>
            {/* A Stack, not a Slot. `Réglages`, `Foyer` and `Historique des
                tickets` used to live inside `(tabs)/`, where iOS's
                `NativeTabs` only routes to the five declared triggers — so
                `router.push('/settings')` was a silent no-op on iOS and the
                only entrance to settings was dead. They are pushed screens,
                never tabs (`AppShell`'s `{ kind: 'stack' }`), so they now sit
                here as siblings of the tab group, which needs a real stack
                navigator at the root to push onto. URLs are unchanged: `(tabs)`
                is a group, so `/settings` was already `/settings`. */}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              {/* Between `(auth)` and `(tabs)`, and a sibling of both: an
                  account with no foyer is signed in but has no screen inside
                  the tabs that could honestly render, so it gets its own
                  group with its own gate. `join` is the deep-link landing
                  route for `fridgeai://join?code=…`. */}
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="join" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="household" />
              <Stack.Screen name="receipts" />
            </Stack>
          </ConnectorProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
