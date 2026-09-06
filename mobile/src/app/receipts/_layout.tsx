import { Stack } from 'expo-router'

export default function ReceiptsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
      <Stack.Screen name="review" />
    </Stack>
  )
}
