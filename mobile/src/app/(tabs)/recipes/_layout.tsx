import { Stack } from 'expo-router'

export default function RecipesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* Declared before `[id]` so `/recipes/generate` resolves to the
          composer rather than to a recipe with the id "generate". Modal
          presentation, same as the receipt scanner: it is a self-contained
          sub-task with one way out. */}
      {/* `gestureEnabled: false` — the composer confirms before discarding an
          unsaved wish (DESIGN.md requires it for any unsaved form), and the
          swipe-down dismiss is the one way out that skipped the confirmation.
          "Fermer" and the Android back button both route through it. */}
      <Stack.Screen name="generate" options={{ presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="[id]" />
    </Stack>
  )
}
