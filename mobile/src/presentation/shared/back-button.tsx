import { Animated, Pressable } from 'react-native'
import { Text } from './tamagui-typed.js'
import { pointerCursor, useHoverPress } from './hover.js'

/** Shared across screens (recipe, shopping-list) — was duplicated verbatim in both before this file existed. */
export function BackButton({ onPress, ink, cream }: { onPress: () => void; ink: string; cream: string }) {
  const hover = useHoverPress()
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      style={pointerCursor}
    >
      <Animated.View
        style={{
          transform: [{ scale: hover.scale }],
          width: 44,
          height: 44,
          borderRadius: 999,
          backgroundColor: cream,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text fontSize={18} fontWeight="800" color={ink}>
          ←
        </Text>
      </Animated.View>
    </Pressable>
  )
}
