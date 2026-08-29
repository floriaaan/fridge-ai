import { useState } from 'react'
import { Animated } from 'react-native'

/**
 * Deliberately quiet — no scale/spring. A list of many rows all bouncing
 * on hover is what this round's feedback was about; a row just needs a
 * "you're over something" and "you pressed it" signal, not a performance.
 * Hover is an instant background tint (a plain boolean, not animated —
 * that's how hover reads on a real web list); press is a brief, fast
 * opacity dip (120ms timing, no spring) so the tap still registers as
 * felt without adding motion to a list that's already busy with content.
 */
export function useQuietRowFeedback() {
  const [hovered, setHovered] = useState(false)
  const [opacity] = useState(() => new Animated.Value(1))
  function pressIn() {
    Animated.timing(opacity, { toValue: 0.6, duration: 100, useNativeDriver: true }).start()
  }
  function pressOut() {
    Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }).start()
  }
  return { hovered, onHoverIn: () => setHovered(true), onHoverOut: () => setHovered(false), opacity, pressIn, pressOut }
}
