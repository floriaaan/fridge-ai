import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

/** Its one remaining caller (`AuthMethodFooter`) sits on the auth shell's dark hero panel — `cream` reads as a light hairline on it, `onDarkSecondary` where `inkSecondary` would disappear. */
export function AuthDivider({ label }: { label: string }) {
  const palette = useSoftPalette()
  return (
    <XStack alignItems="center" gap="$3">
      <YStack flex={1} height={1} backgroundColor={palette.cream} opacity={0.35} />
      <Text fontSize={11} fontWeight="600" color={palette.onDarkSecondary}>
        {label}
      </Text>
      <YStack flex={1} height={1} backgroundColor={palette.cream} opacity={0.35} />
    </XStack>
  )
}
