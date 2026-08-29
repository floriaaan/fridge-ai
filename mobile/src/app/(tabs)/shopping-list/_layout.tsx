import { Stack } from 'expo-router'

export default function ShoppingListLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]/edit" />
    </Stack>
  )
}
