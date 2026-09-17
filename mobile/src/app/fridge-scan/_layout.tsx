import { Stack } from 'expo-router'

export default function FridgeScanLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
      <Stack.Screen name="review" />
    </Stack>
  )
}
