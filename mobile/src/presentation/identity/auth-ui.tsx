/*
 * Auth screens redesign (2026-08-27) — brings sign-in/sign-up into the
 * same "dashboard soft gamifié" world as the household dashboard, which
 * they'd been left out of entirely (raw unstyled Tamagui Input/Button,
 * no branding, no illustration, no error/loading/focus states beyond a
 * plain error line). Same tokens: blob background, warm-mocha card
 * accents, lime primary action, asymmetric radii, hover/press spring on
 * every control.
 */
import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, TextInput, type TextInputProps } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg'
import { ScrollView } from 'tamagui'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

const carrotIllustration = require('../../../assets/illustrations/carrot-3d.png')

/**
 * Same two soft off-center radial blobs as the dashboard's `BlobBackground`,
 * so the whole app shares one ground.
 *
 * Ids are `useId()`-generated, not hardcoded strings, because sign-in and
 * sign-up both mount this component and both live in the same `(auth)`
 * Stack navigator, which keeps prior screens in the tree (for back-swipe)
 * rather than unmounting them — two `<RadialGradient id="authBlob1">`
 * elements in one DOM collide, and `fill="url(#authBlob1)"` resolves to
 * whichever one the browser picks, which is how sign-up rendered blank.
 */
function AuthBlobBackground() {
  const palette = useSoftPalette()
  const id1 = useId()
  const id2 = useId()
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
      <Defs>
        <RadialGradient id={id1} cx="18%" cy="-8%" r="65%">
          <Stop offset="0" stopColor={palette.blobStrong} stopOpacity={0.85} />
          <Stop offset="0.5" stopColor={palette.blobSoft} stopOpacity={0.5} />
          <Stop offset="1" stopColor={palette.gradientBottom} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={id2} cx="92%" cy="100%" r="60%">
          <Stop offset="0" stopColor={palette.blobSoft} stopOpacity={0.7} />
          <Stop offset="1" stopColor={palette.gradientBottom} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={palette.gradientBottom} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id2})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id1})`} />
    </Svg>
  )
}

/**
 * The shared shell for sign-in/sign-up: blob ground, carrot+wordmark
 * branding, one white asymmetric-radius card holding the form — centered
 * and width-capped on every screen size instead of a full-bleed column,
 * which is what "stretched to a 1440px browser window" actually looked
 * like before this pass.
 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const palette = useSoftPalette()
  return (
    <YStack flex={1} minHeight={0} backgroundColor={palette.gradientBottom} style={{ position: 'relative' }}>
      <AuthBlobBackground />
      <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={['top', 'bottom']}>
        {/* KeyboardAvoidingView: without it, the keyboard covered the
            submit button / PocketID row on real devices — a real gap the
            audit caught (no keyboard handling existed on either auth
            screen). 'padding' behavior on iOS, none needed on Android
            (which resizes the window by default). */}
        <KeyboardAvoidingView
          style={{ flex: 1, minHeight: 0 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingVertical: 32,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <YStack width="100%" maxWidth={400} gap="$5" alignItems="center">
              <XStack alignItems="center" gap="$2">
                <Image source={carrotIllustration} style={{ width: 36, height: 36 }} resizeMode="contain" accessibilityLabel="" />
                <Text fontSize={16} fontWeight="800" letterSpacing={1} color={palette.ink}>
                  FRIDGE AI
                </Text>
              </XStack>

              <YStack
                width="100%"
                backgroundColor={palette.gradientBottom}
                padding="$5"
                gap="$4"
                style={{
                  borderTopLeftRadius: 32,
                  borderTopRightRadius: 20,
                  borderBottomRightRadius: 32,
                  borderBottomLeftRadius: 20,
                  shadowColor: palette.shadowWarm,
                  shadowOffset: { width: 0, height: 18 },
                  shadowOpacity: 0.12,
                  shadowRadius: 30,
                  elevation: 4,
                }}
              >
                <YStack gap="$1">
                  <Text fontSize={20} fontWeight="800" color={palette.ink}>
                    {title}
                  </Text>
                  <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
                    {subtitle}
                  </Text>
                </YStack>
                {children}
              </YStack>
            </YStack>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </YStack>
  )
}

/** Label above, rounded field below, lime focus ring — replaces the raw Tamagui `Input`. */
export function AuthField({
  label,
  testID,
  ...inputProps
}: TextInputProps & { label: string; testID?: string }) {
  const palette = useSoftPalette()
  const [focused, setFocused] = useState(false)
  return (
    <YStack gap="$1.5">
      <Text fontSize={12} fontWeight="600" color={palette.inkSecondary}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        testID={testID}
        accessibilityLabel={label}
        onFocus={(e) => {
          setFocused(true)
          inputProps.onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          inputProps.onBlur?.(e)
        }}
        placeholderTextColor={palette.inkSecondary}
        style={{
          // minHeight, not height: at large Dynamic Type / font-scale
          // settings the text needs room to grow taller than 48 — a
          // fixed height would clip it instead of letting the field grow
          // (an audit finding: every fixed-height control was a risk).
          minHeight: 48,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 12,
          fontSize: 14,
          color: palette.ink,
          backgroundColor: palette.cream,
          borderWidth: 2,
          borderColor: focused ? palette.accentLime : 'transparent',
        }}
      />
    </YStack>
  )
}

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
