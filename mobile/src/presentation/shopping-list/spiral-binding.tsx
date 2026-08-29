import { XStack, YStack } from '../shared/tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/** A flat strip of punched holes + a thin ring each — the pad's spiral edge. Flat top corners, not rounded: a coil runs along a straight edge. */
export function SpiralBinding({ palette }: { palette: SoftPalette }) {
  const holes = Array.from({ length: 10 })
  return (
    <XStack
      justifyContent="space-around"
      alignItems="center"
      paddingVertical="$1.5"
      backgroundColor={palette.paperBindingStrip}
      style={{ borderTopLeftRadius: 4, borderTopRightRadius: 4 }}
    >
      {holes.map((_, i) => (
        <YStack
          key={i}
          width={9}
          height={9}
          borderRadius={999}
          backgroundColor={palette.paperHole}
          style={{ borderWidth: 1.5, borderColor: palette.paperRing }}
        />
      ))}
    </XStack>
  )
}
