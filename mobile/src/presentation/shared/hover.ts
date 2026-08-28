import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, Platform } from 'react-native'

// Web-only pointer cursor — RN silently ignores unknown style keys on native,
// so this is safe to spread unconditionally, but Platform.select keeps intent explicit.
export const pointerCursor = Platform.select({ web: { cursor: 'pointer' as const }, default: {} })

/**
 * Tracks the OS "Reduce Motion" setting (iOS/Android; RN Web maps this to
 * `prefers-reduced-motion` on modern versions). An audit found every
 * animation in the app — hover/press springs, the hero entrance — ignored
 * this setting entirely.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (mounted) setReduced(value)
      })
      .catch(() => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value: boolean) => {
      setReduced(value)
    })
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])
  return reduced
}

/**
 * Hover (web) + press (all platforms) feedback as one spring-driven scale.
 * RN Web's `Pressable` fires `onHoverIn`/`onHoverOut`; native ignores them.
 *
 * With Reduce Motion on, the scale still applies (it's the state-change
 * signal — a press did register) but instantly, via `Animated.timing`
 * with `duration: 0`, instead of a bouncy spring: the craft floor's rule
 * is "preserve state change and hierarchy," not "kill all feedback."
 */
export function useHoverPress() {
  const [scale] = useState(() => new Animated.Value(1))
  const reduceMotion = useReduceMotion()
  function to(value: number, friction: number) {
    if (reduceMotion) {
      Animated.timing(scale, { toValue: value, duration: 0, useNativeDriver: true }).start()
      return
    }
    Animated.spring(scale, { toValue: value, friction, tension: 200, useNativeDriver: true }).start()
  }
  return {
    scale,
    onHoverIn: () => to(1.035, 6),
    onHoverOut: () => to(1, 6),
    onPressIn: () => to(0.96, 5),
    onPressOut: () => to(1, 4),
  }
}
