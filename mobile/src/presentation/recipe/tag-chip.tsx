import { Text, XStack } from '../shared/tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export function TagChip({ label, palette }: { label: string; palette: SoftPalette }) {
  return (
    <XStack backgroundColor={palette.mintPale} borderRadius={999} paddingVertical="$1" paddingHorizontal="$2.5">
      <Text fontSize={11} fontWeight="700" color={palette.mintPaleText}>
        {label}
      </Text>
    </XStack>
  )
}
