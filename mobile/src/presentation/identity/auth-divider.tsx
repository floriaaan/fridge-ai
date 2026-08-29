import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

export function AuthDivider({ label }: { label: string }) {
  const palette = useSoftPalette()
  return (
    <XStack alignItems="center" gap="$3">
      <YStack flex={1} height={1} backgroundColor={palette.cream} />
      <Text fontSize={11} fontWeight="600" color={palette.inkSecondary}>
        {label}
      </Text>
      <YStack flex={1} height={1} backgroundColor={palette.cream} />
    </XStack>
  )
}
