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

  useEffect(() => () => {
    if (timeout.current) clearTimeout(timeout.current)
  }, [])

  return [hint, show]
}

/**
 * Android gets a Material 3 **Snackbar**: a left-aligned rectangle on
 * `inverseSurface`, 4dp radius, elevation 3, sitting above the navigation bar
 * — the platform's own component for transient feedback, untouched by the
 * card redesign below (a 2026-09 complaint: "pill flottant" read as too
 * discreet — that was never Android's shape to begin with).
 *
 * iOS/web: a full-width card, one uniform corner radius on every side (a
 * 2026-09 complaint: the earlier asymmetric radii it borrowed from
 * `IngredientGroup`/`CookedAction` read as inconsistent borders on a toast,
 * where every other surface — Android's Snackbar included — keeps all four
 * corners equal) — same content, same timing, same live region.
 */
export function HintBubble({
  hint,
  palette,
  liftForNativeTabBar,
}: {
  hint: Hint | null
  palette: SoftPalette
  /**
   * True on iOS whenever the real `NativeTabs` bar is the one on screen —
   * AppShell's `isNativeTabBar`. That bar is a system view drawn by a
   * navigator outside this tree, so the fixed 18pt below (tuned to just
   * clear the home indicator when no bar exists at all) put the toast right
   * behind it: reported as "sous la tab bar sur iOS donc pas visible". No
   * exact height is available without `useSafeAreaInsets` (no
   * `SafeAreaProvider` is mounted — see `action-sheet.tsx`), so this is the
   * same kind of empirical clearance Android's own branch below already
   * uses for its 80pt bar.
   */
  liftForNativeTabBar?: boolean
}) {
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
  const entrance = {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  }

  if (IS_ANDROID) {
    return (
      <Animated.View
        style={[{ position: 'absolute', left: 16, right: 16, bottom: 96 }, entrance]}
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

  const bg = rendered.kind === 'success' ? palette.mintPale : rendered.kind === 'error' ? palette.expiredBg : palette.brandDeep
  const text = rendered.kind === 'success' ? palette.mintPaleText : rendered.kind === 'error' ? palette.expiredText : palette.brandDeepText
  const Icon = rendered.kind === 'success' ? CircleCheckIcon : rendered.kind === 'error' ? TriangleAlertIcon : null

  return (
    <Animated.View
      style={[{ position: 'absolute', left: 20, right: 20, bottom: liftForNativeTabBar ? 100 : 18 }, entrance]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      <XStack
        alignItems="center"
        gap="$2"
        backgroundColor={bg}
        paddingVertical="$3"
        paddingHorizontal="$4"
        minHeight={52}
        style={{
          borderRadius: 18,
          ...surfaceShadow(palette, 3, { offsetY: 10, opacity: 0.18, radius: 20 }),
        }}
      >
        {Icon ? <Icon size={18} color={text} /> : null}
        <Text fontSize={13} fontWeight="700" color={text} flex={1}>
          {rendered.message}
        </Text>
      </XStack>
    </Animated.View>
  )
}
