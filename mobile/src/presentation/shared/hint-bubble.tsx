/**
 * The "bientôt disponible" toast pattern, shared: any tap with no real
 * destination yet surfaces an honest hint instead of doing nothing — see
 * household-dashboard.tsx's own (inline) copy of this idea. Extracted
 * here so new screens don't reinvent it or, worse, ship a silent no-op.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Text, YStack } from './tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { IS_ANDROID, materialRoles, surfaceShadow } from './material.js'

/** Hints clear themselves: a toast that never leaves stops reading as feedback. */
const HINT_MS = 3200

export function useHint(): [string | null, (message: string) => void] {
  const [hint, setHint] = useState<string | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((message: string) => {
    if (timeout.current) clearTimeout(timeout.current)
    setHint(message)
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
 * — the platform's own component for transient feedback. iOS and web keep the
 * centered brand pill this system already had, which is the idiom over there.
 *
 * Same content, same timing, same live region on both. Only the shape and the
 * placement follow the platform, which is exactly the split `android.md`
 * describes: Material governs structure, brand expresses through it.
 */
export function HintBubble({ hint, palette }: { hint: string | null; palette: SoftPalette }) {
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
            {hint}
          </Text>
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack
      position="absolute"
      left={0}
      right={0}
      bottom={18}
      alignItems="center"
      style={{ pointerEvents: 'none' }}
      accessibilityLiveRegion="polite"
    >
      <YStack backgroundColor={palette.brandDeep} borderRadius={999} paddingVertical="$1.5" paddingHorizontal="$4">
        <Text fontSize={12} fontWeight="600" color={palette.brandDeepText}>
          {hint}
        </Text>
      </YStack>
    </YStack>
  )
}
