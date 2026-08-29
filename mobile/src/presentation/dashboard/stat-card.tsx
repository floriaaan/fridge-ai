import { Text, YStack } from '../shared/tamagui-typed.js'
import type { SoftPalette } from './soft-palette.js'

export function StatCard({
  bg,
  labelColor,
  valueColor,
  chipColor,
  icon,
  label,
  value,
  corner,
  palette,
}: {
  bg: string
  labelColor: string
  valueColor: string
  chipColor: string
  icon: React.ReactNode
  label: string
  value: string
  corner: 'a' | 'b' | 'c'
  palette: SoftPalette
}) {
  // Three slightly different asymmetric corner sets so the row of pastel
  // cards reads as expressive/organic rather than three identical stamps.
  const radii =
    corner === 'a'
      ? { borderTopLeftRadius: 26, borderTopRightRadius: 14, borderBottomRightRadius: 26, borderBottomLeftRadius: 14 }
      : corner === 'b'
        ? { borderTopLeftRadius: 14, borderTopRightRadius: 26, borderBottomRightRadius: 14, borderBottomLeftRadius: 26 }
        : { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomRightRadius: 14, borderBottomLeftRadius: 14 }

  return (
    <YStack
      flex={1}
      backgroundColor={bg}
      padding="$4"
      gap="$2"
      style={{ ...radii, shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 3 }}
    >
      <YStack width={36} height={36} borderRadius={12} backgroundColor={chipColor} alignItems="center" justifyContent="center">
        {icon}
      </YStack>
      <YStack>
        <Text fontSize={12} fontWeight="500" color={labelColor}>
          {label}
        </Text>
        <Text fontSize={22} fontWeight="800" color={valueColor} marginTop="$1">
          {value}
        </Text>
      </YStack>
    </YStack>
  )
}
