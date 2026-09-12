/**
 * The "bientôt disponible" toast pattern, shared: any tap with no real
 * destination yet surfaces an honest hint instead of doing nothing — see
 * household-dashboard.tsx's own (inline) copy of this idea. Extracted
 * here so new screens don't reinvent it or, worse, ship a silent no-op.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { Text, XStack, YStack } from './tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { IS_ANDROID, materialRoles, surfaceShadow } from './material.js'
import { TOAST_PILL_STYLE, ToastPillLayer, toastPillShadow } from './toast-pill.js'
import { CircleCheckIcon, TriangleAlertIcon } from '../dashboard/dashboard-icons.js'
import { useReduceMotion } from './hover.js'

/** Hints clear themselves: a toast that never leaves stops reading as feedback. */
const HINT_MS = 3200

export interface Hint {
  message: string
  /**
   * Undecorated by default (every screen but recipe-detail today): plain
   * text, `brandDeep`, no icon — unchanged from before this had a `kind` at
   * all. `'success'`/`'error'` pick a pastel surface + icon instead —
   * `mintPale` (same positive pairing "J'ai cuisiné" uses) or `expiredBg`
   * (same destructive pairing the delete `ActionSheet` uses), never
   * `brandDeep`. A screen that always passes an explicit kind (recipe-detail
   * does, for all three of its messages) never hits the dark default, which
   * is what keeps it off DESIGN.md's One Dark Surface Rule — the screen's
   * own hero block is already the one `brandDeep` surface there.
   */
  kind?: 'success' | 'error'
}

export function useHint(): [Hint | null, (message: string, kind?: Hint['kind']) => void] {
  const [hint, setHint] = useState<Hint | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((message: string, kind?: Hint['kind']) => {
    if (timeout.current) clearTimeout(timeout.current)
    setHint({ message, kind })
    timeout.current = setTimeout(() => setHint(null), HINT_MS)
  }, [])

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current)
    },
    [],
  )

  return [hint, show]
}

/**
 * Android gets a Material 3 **Snackbar**: a left-aligned rectangle on
 * `inverseSurface`, 4dp radius, elevation 3, sitting above the navigation bar
 * — the platform's own component for transient feedback, deliberately its
 * own shape and position, not unified with the pill below.
 *
 * iOS/web: the same floating top pill as `ToastHost` (the network/transport
 * toast) — `toast-pill.tsx` is the one place both get their shape, position
 * and shadow from, so the two can't drift apart the way this toast's
 * earlier bottom card and that pill once did (2026-09 request: make this
 * one look like that one). Sitting at the top instead of the bottom also
 * retires the old `liftForNativeTabBar` clearance prop entirely — there is
 * no tab bar up there to clear.
 */
export function HintBubble({ hint, palette }: { hint: Hint | null; palette: SoftPalette }) {
  const reduceMotion = useReduceMotion()
  // A hint clearing itself is a prop going straight to null — with no state
  // of its own the toast would vanish in the same frame it appeared in, so
  // `rendered` holds the last real hint through the exit fade, and the exit
  // animation is what actually unmounts it. Adjusted during render (React's
  // own pattern for mirroring a changed prop into state) rather than in the
  // effect below, which is left to do only the actual side effect: driving
  // the animation.
  const [rendered, setRendered] = useState<Hint | null>(null)
  const [trackedHint, setTrackedHint] = useState<Hint | null>(hint)
  const [progress] = useState(() => new Animated.Value(0))

  if (hint !== trackedHint) {
    setTrackedHint(hint)
    if (hint) setRendered(hint)
  }

  useEffect(() => {
    if (hint) {
      Animated.timing(progress, {
        toValue: 1,
        duration: reduceMotion ? 0 : 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: reduceMotion ? 0 : 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(null)
      })
    }
  }, [hint, progress, reduceMotion])

  if (!rendered) return null
  const roles = materialRoles(palette)

  if (IS_ANDROID) {
    const androidEntrance = {
      opacity: progress,
      transform: [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
      ],
    }
    return (
      <Animated.View
        style={[{ position: 'absolute', left: 16, right: 16, bottom: 96 }, androidEntrance]}
        pointerEvents="none"
        accessibilityLiveRegion="polite"
      >
        <YStack
          backgroundColor={roles.inverseSurface}
          borderRadius={4}
          paddingVertical={14}
          paddingHorizontal={16}
          minHeight={48}
          justifyContent="center"
          style={surfaceShadow(palette, 3, { offsetY: 6, opacity: 0.2, radius: 12 })}
        >
          <Text fontSize={14} fontWeight="500" color={roles.inverseOnSurface}>
            {rendered.message}
          </Text>
        </YStack>
      </Animated.View>
    )
  }

  const bg =
    rendered.kind === 'success'
      ? palette.mintPale
      : rendered.kind === 'error'
        ? palette.expiredBg
        : palette.brandDeep
  const text =
    rendered.kind === 'success'
      ? palette.mintPaleText
      : rendered.kind === 'error'
        ? palette.expiredText
        : palette.brandDeepText
  const Icon =
    rendered.kind === 'success'
      ? CircleCheckIcon
      : rendered.kind === 'error'
        ? TriangleAlertIcon
        : null

  return (
    <ToastPillLayer progress={progress} pointerEvents="none">
      <XStack
        alignItems="center"
        gap="$2"
        backgroundColor={bg}
        accessibilityLiveRegion="polite"
        style={[TOAST_PILL_STYLE, toastPillShadow(palette)]}
      >
        {Icon ? <Icon size={18} color={text} /> : null}
        {/* No `flex={1}` (unlike the old edge-to-edge card): the pill now
            shrink-wraps to its content up to `maxWidth`, and `flex={1}` on
            a `Text` inside a content-sized row resolves to zero width in
            RN's layout — the message rendered invisible, background and
            icon still showing, while the same markup worked fine on the
            old full-width row where the parent had a real, non-content-sized
            width to distribute. `ToastHost`'s pill never had this bug: its
            `Text` was never given `flex={1}` to begin with. */}
        <Text fontSize={13} fontWeight="700" color={text}>
          {rendered.message}
        </Text>
      </XStack>
    </ToastPillLayer>
  )
}
