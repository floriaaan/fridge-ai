/**
 * The "bientôt disponible" toast pattern, shared: any tap with no real
 * destination yet surfaces an honest hint instead of doing nothing — see
 * household-dashboard.tsx's own (inline) copy of this idea. Extracted
 * here so new screens don't reinvent it or, worse, ship a silent no-op.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Text, XStack, YStack } from './tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { IS_ANDROID, materialRoles, surfaceShadow } from './material.js'
import { CircleCheckIcon, TriangleAlertIcon } from '../dashboard/dashboard-icons.js'

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
 * iOS/web: a full-width card, asymmetric radii matching every other card in
 * this system (`IngredientGroup`, `CookedAction`…), not the shrink-to-fit
 * pill this used to be — same content, same timing, same live region.
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
  if (!hint) return null
  const roles = materialRoles(palette)

  if (IS_ANDROID) {
    return (
      <YStack
        position="absolute"
        left={16}
        right={16}
        bottom={96}
        style={{ pointerEvents: 'none' }}
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
            {hint.message}
          </Text>
        </YStack>
      </YStack>
    )
  }

  const bg = hint.kind === 'success' ? palette.mintPale : hint.kind === 'error' ? palette.expiredBg : palette.brandDeep
  const text = hint.kind === 'success' ? palette.mintPaleText : hint.kind === 'error' ? palette.expiredText : palette.brandDeepText
  const Icon = hint.kind === 'success' ? CircleCheckIcon : hint.kind === 'error' ? TriangleAlertIcon : null

  return (
    <YStack
      position="absolute"
      left={20}
      right={20}
      bottom={liftForNativeTabBar ? 100 : 18}
      style={{ pointerEvents: 'none' }}
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
          borderTopLeftRadius: 26,
          borderTopRightRadius: 14,
          borderBottomRightRadius: 26,
          borderBottomLeftRadius: 14,
          ...surfaceShadow(palette, 3, { offsetY: 10, opacity: 0.18, radius: 20 }),
        }}
      >
        {Icon ? <Icon size={18} color={text} /> : null}
        <Text fontSize={13} fontWeight="700" color={text} flex={1}>
          {hint.message}
        </Text>
      </XStack>
    </YStack>
  )
}
