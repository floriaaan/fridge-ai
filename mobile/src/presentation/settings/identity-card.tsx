import type { ReactNode } from 'react'
import { Animated, Pressable } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { ChevronRightIcon } from '../dashboard/dashboard-icons.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/**
 * The full-width identity card used at the top of Réglages for the account
 * and the foyer.
 *
 * Réglages used to open on a `StatCard` pair — two flex-1 pastel cards side
 * by side, the same component the dashboard uses for a two-digit metric.
 * A metric fits in half a phone width; a household name does not. "Le foyer
 * de Florian" rendered as "Le foyer de F…" on every phone, and the one line
 * that had to carry the foyer's identity was the one line that got cut. The
 * card that names a thing gets the whole width; the cards that count things
 * keep sharing one.
 *
 * Same pastel language as `StatCard` (fill, 36pt saturated icon chip,
 * card-float shadow, its own asymmetric corner set), turned on its side: the
 * chip moves beside the text instead of above it, which is what buys the
 * name its full measure. `trailing` takes the foyer's role badge, `footer`
 * the member avatars — both absent on the account card, which is a plain
 * container rather than a pressable.
 */
export function IdentityCard({
  testID,
  bg,
  labelColor,
  chipColor,
  icon,
  label,
  value,
  secondary,
  trailing,
  footer,
  corner,
  palette,
  onPress,
  accessibilityLabel,
}: {
  testID?: string
  bg: string
  labelColor: string
  chipColor: string
  icon: ReactNode
  label: string
  value: string
  secondary?: string
  /** Right-aligned badge on the label row — the foyer's role. */
  trailing?: ReactNode
  /** A row under the value — the foyer's member avatars. */
  footer?: ReactNode
  corner: 'a' | 'b'
  palette: SoftPalette
  onPress?: () => void
  accessibilityLabel?: string
}) {
  const hover = useHoverPress()
  // Wider than StatCard's sets, because these cards are wider — a 26pt
  // corner that reads generous on a half-width tile reads timid across the
  // full column. Two sets, mirrored, so the stacked pair never repeats one.
  const radii =
    corner === 'a'
      ? { borderTopLeftRadius: 30, borderTopRightRadius: 16, borderBottomRightRadius: 30, borderBottomLeftRadius: 16 }
      : { borderTopLeftRadius: 16, borderTopRightRadius: 30, borderBottomRightRadius: 16, borderBottomLeftRadius: 30 }

  const card = (
    <YStack
      testID={onPress ? undefined : testID}
      backgroundColor={bg}
      padding="$4"
      gap="$3"
      style={{ ...radii, shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 3 }}
    >
      <XStack alignItems="center" gap="$3">
        <YStack width={36} height={36} borderRadius={12} backgroundColor={chipColor} alignItems="center" justifyContent="center">
          {icon}
        </YStack>
        <YStack flex={1} minWidth={0}>
          <Text fontSize={12} fontWeight="500" color={labelColor}>
            {label}
          </Text>
          {/* Two lines, not one: this card exists because "Le foyer de Florian"
              was cut to "Le foyer de F…". Buying the width and keeping the
              one-line clamp would have kept the scissors. */}
          <Text fontSize={20} fontWeight="800" color={palette.ink} marginTop="$0.5" numberOfLines={2}>
            {value}
          </Text>
          {secondary ? (
            <Text fontSize={12} fontWeight="500" color={labelColor} marginTop="$0.5" numberOfLines={1}>
              {secondary}
            </Text>
          ) : null}
        </YStack>
        {trailing}
        {onPress ? <ChevronRightIcon size={18} color={labelColor} /> : null}
      </XStack>
      {footer}
    </YStack>
  )

  if (!onPress) return card

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? value}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>{card}</Animated.View>
    </Pressable>
  )
}

/** The role badge on the foyer card — a pill, per the system's "pill means status/action/badge" rule. */
export function RoleBadge({ label, palette }: { label: string; palette: SoftPalette }) {
  return (
    <XStack backgroundColor={palette.gradientBottom} paddingVertical="$1" paddingHorizontal="$2.5" borderRadius={999}>
      <Text fontSize={11} fontWeight="700" color={palette.mintPaleText}>
        {label}
      </Text>
    </XStack>
  )
}
