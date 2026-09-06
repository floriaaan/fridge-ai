import type { ReactNode } from 'react'
import { ActivityIndicator, Animated, Pressable } from 'react-native'
import { Text } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { ripple } from '../shared/material.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

/**
 * Full-width pill, lime (primary) or outlined warm-mocha (secondary) — spring
 * hover/press on iOS and web, a bounded Material ripple on Android.
 *
 * While `pending`, the leading slot swaps the button's icon for a spinner and
 * the label swaps to `pendingLabel`. The label alone was doing the work
 * before ("Connexion…"), which is a state you have to *read*: at arm's length,
 * holding groceries, a button that has visibly changed shape is the faster
 * signal, and the spinner is the only element on it that says the wait is
 * still running rather than stuck.
 */
export function AuthButton({
  label,
  pendingLabel,
  pending,
  disabled,
  onPress,
  variant = 'primary',
  icon,
  testID,
}: {
  label: string
  pendingLabel?: string
  pending?: boolean
  /**
   * Inert because the form is not answerable yet — distinct from `pending`,
   * which is inert because it is already running. Both dim to 0.6 and both
   * refuse the press; only `pending` swaps in the spinner and the label.
   */
  disabled?: boolean
  onPress: () => void
  variant?: 'primary' | 'secondary'
  icon?: ReactNode
  testID?: string
}) {
  const palette = useSoftPalette()
  const hover = useHoverPress()
  const isPrimary = variant === 'primary'
  const inert = Boolean(pending || disabled)
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: pending }}
      android_ripple={ripple(isPrimary ? palette.accentLimeText : palette.ink)}
      style={pointerCursor}
    >
      <Animated.View
        style={{
          transform: [{ scale: hover.scale }],
          opacity: inert ? 0.6 : 1,
          // minHeight, not height — same Dynamic Type reasoning as
          // AuthField: a large system font size needs the pill to grow,
          // not clip the label.
          minHeight: 50,
          paddingVertical: 10,
          borderRadius: 999,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: isPrimary ? palette.accentLime : 'transparent',
          borderWidth: isPrimary ? 0 : 2,
          // `ink`, not `brandDeep` — brandDeep (#6B5642) reads fine on the
          // light card in light mode (~6:1) but drops to ~2.8:1 against
          // the near-black card in dark mode, since brandDeep is
          // deliberately identical across themes while the card isn't.
          // `ink` is already guaranteed high-contrast against the card
          // (gradientBottom) in both themes — a real bug caught by
          // actually rendering dark mode, not just computing light-mode
          // contrast and assuming it carried over.
          borderColor: palette.ink,
        }}
      >
        {pending ? (
          <ActivityIndicator
            testID={testID ? `${testID}-spinner` : undefined}
            size="small"
            color={isPrimary ? palette.accentLimeText : palette.ink}
          />
        ) : (
          icon
        )}
        <Text fontSize={14} fontWeight="800" color={isPrimary ? palette.accentLimeText : palette.ink}>
          {pending ? (pendingLabel ?? label) : label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}
