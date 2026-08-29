import type { ReactNode } from 'react'
import { Animated, Pressable } from 'react-native'
import { Text } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

/** Full-width pill, lime (primary) or outlined warm-mocha (secondary) — spring hover/press like every other control in the app. */
export function AuthButton({
  label,
  pendingLabel,
  pending,
  onPress,
  variant = 'primary',
  icon,
  testID,
}: {
  label: string
  pendingLabel?: string
  pending?: boolean
  onPress: () => void
  variant?: 'primary' | 'secondary'
  icon?: ReactNode
  testID?: string
}) {
  const palette = useSoftPalette()
  const hover = useHoverPress()
  const isPrimary = variant === 'primary'
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: pending }}
      style={pointerCursor}
    >
      <Animated.View
        style={{
          transform: [{ scale: hover.scale }],
          opacity: pending ? 0.6 : 1,
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
        {icon}
        <Text fontSize={14} fontWeight="800" color={isPrimary ? palette.accentLimeText : palette.ink}>
          {pending ? (pendingLabel ?? label) : label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}
