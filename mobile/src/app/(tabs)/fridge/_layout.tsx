import { Stack } from 'expo-router'

export default function FridgeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]/edit" />
      <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
