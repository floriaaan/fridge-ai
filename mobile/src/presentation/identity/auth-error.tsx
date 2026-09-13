import { Text, XStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

/**
 * Coral chip, same status-color language as the dashboard — replaces the
 * plain `ErrorState` text line on auth screens.
 *
 * `accessibilityLiveRegion`/`accessibilityRole="alert"` — `FormField`'s own
 * per-field error carries both (DESIGN.md), and this one didn't: a failed
 * sign-in swapped the button back from `pending` with nothing else visibly
 * changing, so a screen reader announced no error at all at exactly the
 * moment it mattered most.
 */
export function AuthError({ message }: { message: string }) {
  const palette = useSoftPalette()
  return (
    <XStack
      backgroundColor={palette.expiredBg}
      borderRadius={14}
      padding="$3"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text fontSize={13} fontWeight="600" color={palette.expiredText} flex={1}>
        {message}
      </Text>
    </XStack>
  )
}
