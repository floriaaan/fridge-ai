import { useEffect, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { Path, Svg } from 'react-native-svg'
import { useReduceMotion } from '../shared/hover.js'

const AnimatedPath = Animated.createAnimatedComponent(Path)

/** Longer than the path's real length so the dash hides it completely before the draw-on starts. */
const DASH_LENGTH = 40

/**
 * One confident, slightly organic curve — not a jittery scribble. Two
 * cubic segments instead of straight lines is what reads as "drawn," not
 * "off-model icon." It draws itself in on mount — the moment an item gets
 * checked — rather than appearing whole: the one stroke this component ever
 * makes is the one action the row exists to confirm.
 */
export function HandDrawnCheck({ size, color }: { size: number; color: string }) {
  const reduceMotion = useReduceMotion()
  const [progress] = useState(() => new Animated.Value(0))

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion ? 0 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
    // Draw-on plays once, on this mount — HandDrawnCheck only ever mounts for
    // a just-checked row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <AnimatedPath
        d="M4.5 12.8 C6 12 7.6 14.8 9.3 17 C12.5 13.2 16.2 8.3 19.6 5.2"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={DASH_LENGTH}
        strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [DASH_LENGTH, 0] })}
      />
    </Svg>
  )
}
