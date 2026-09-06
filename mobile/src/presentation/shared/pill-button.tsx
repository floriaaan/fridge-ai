/**
 * The one lime action pill.
 *
 * There were five independent implementations of it — `AddProductButton` and
 * the empty/error pills in the garde-manger, `EmptyAction` and the hero's
 * retry on the dashboard, the shopping list's and the receipt history's empty
 * actions — each with its own padding, its own hover wiring (or none), and its
 * own idea of whether it stretched. The chips were consolidated into one
 * component; the pills never were, so the app's second-most-repeated control
 * drifted in five directions.
 *
 * `alignSelf: 'flex-start'` is the load-bearing default: a Pressable in a
 * YStack stretches, and a pill that stretches stops being a pill.
 *
 * `AuthButton` stays separate on purpose — it is the 50pt full-width form
 * submit of the auth screens, a different control with a different job.
 */
import type { ReactNode } from 'react'
import { Animated, Pressable } from 'react-native'
import { Text, XStack } from './tamagui-typed.js'
import { pointerCursor, useHoverPress } from './hover.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export function PillButton({
  testID,
  label,
  onPress,
  palette,
  icon,
  accessibilityLabel,
  tone = 'accent',
}: {
  testID?: string
  label: string
  onPress: () => void
  palette: SoftPalette
  /** `accent` is the lime primary; `quiet` is the cream secondary that sits beside it (the empty fridge's two ways in). */
  tone?: 'accent' | 'quiet'
  /** Called with the label colour so the glyph always matches the text beside it. */
  icon?: (color: string) => ReactNode
  /** Announced instead of `label` when the label alone is not a sentence ("Réessayer"). */
  accessibilityLabel?: string
}) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[pointerCursor, { alignSelf: 'flex-start' }]}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack
          alignItems="center"
          gap="$1.5"
          minHeight={44}
          paddingHorizontal="$4"
          borderRadius={999}
          justifyContent="center"
          backgroundColor={tone === 'accent' ? palette.accentLime : palette.cream}
        >
          {icon ? icon(tone === 'accent' ? palette.accentLimeText : palette.ink) : null}
          <Text fontSize={14} fontWeight="800" color={tone === 'accent' ? palette.accentLimeText : palette.ink}>
            {label}
          </Text>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
