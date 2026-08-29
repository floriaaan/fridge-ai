import { Path, Svg } from 'react-native-svg'
import { Text, YStack } from '../shared/tamagui-typed.js'

/** A wavy pen-stroke strikethrough — drawn, not `textDecorationLine`. Sized to the text's own box, not the row's. */
export function CheckedName({ children, color }: { children: string; color: string }) {
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
        <Path
          d="M2 11 C 15 7, 22 14, 35 10 C 50 6, 60 14, 75 9 C 85 6, 92 11, 98 9"
          stroke={color}
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </YStack>
  )
}
