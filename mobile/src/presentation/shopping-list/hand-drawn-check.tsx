import { Path, Svg } from 'react-native-svg'

/**
 * One confident, slightly organic curve — not a jittery scribble. Two
 * cubic segments instead of straight lines is what reads as "drawn," not
 * "off-model icon."
 */
export function HandDrawnCheck({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 12.8 C6 12 7.6 14.8 9.3 17 C12.5 13.2 16.2 8.3 19.6 5.2"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
