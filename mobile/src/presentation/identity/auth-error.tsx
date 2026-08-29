import { Text, XStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

/** Coral chip, same status-color language as the dashboard — replaces the plain `ErrorState` text line on auth screens. */
export function AuthError({ message }: { message: string }) {
  const palette = useSoftPalette()
  return (
    <XStack backgroundColor={palette.expiredBg} borderRadius={14} padding="$3">
      <Text fontSize={13} fontWeight="600" color={palette.expiredText} flex={1}>
        {message}
      </Text>
    </XStack>
  )
}
