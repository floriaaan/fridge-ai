import { useEffect, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { Path, Svg } from 'react-native-svg'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { useReduceMotion } from '../shared/hover.js'

const AnimatedPath = Animated.createAnimatedComponent(Path)

/** Longer than the path's real length so the dash hides it completely before the draw-on starts. */
const DASH_LENGTH = 220
/** Lets the checkbox's own stroke finish first — the name gets crossed out a beat after the item is checked, not in the same instant. */
const START_DELAY = 80

/**
 * A wavy pen-stroke strikethrough — drawn, not `textDecorationLine`. Sized
 * to the text's own box, not the row's. Draws itself on mount, right after
 * `HandDrawnCheck`'s own stroke, so checking an item reads as one pen
 * finishing a small job — mark the box, then strike the name — rather than
 * two unrelated shapes appearing at once.
 */
export function CheckedName({ children, color }: { children: string; color: string }) {
  const reduceMotion = useReduceMotion()
  const [progress] = useState(() => new Animated.Value(0))

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion ? 0 : 260,
      delay: reduceMotion ? 0 : START_DELAY,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <YStack style={{ position: 'relative', alignSelf: 'flex-start' }}>
      <Text fontSize={14} fontWeight="700" color={color}>
        {children}
      </Text>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 20"
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        <AnimatedPath
          d="M2 11 C 15 7, 22 14, 35 10 C 50 6, 60 14, 75 9 C 85 6, 92 11, 98 9"
          stroke={color}
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={DASH_LENGTH}
          strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [DASH_LENGTH, 0] })}
        />
      </Svg>
    </YStack>
  )
}
