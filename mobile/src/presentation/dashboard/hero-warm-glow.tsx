import { useId } from 'react'
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg'

/**
 * A low, warm ember-colored glow in one corner of the hero card — the
 * "chaleureuse" pass: the flat near-black forest green read as corporate
 * rather than cozy, so this adds a lamplight-warm accent without moving
 * off the established dark-hero identity (`brandDeep` itself was also
 * warmed slightly — see soft-palette.ts).
 *
 * It fills its parent edge-to-edge (all four insets pinned, not just
 * top/left), so the parent must be the *unpadded* card box with the content
 * in an inner padded child. Pinning only `top/left` and asking for
 * `width:100%` measured the parent's content box instead: on a card with
 * `padding:$5` the glow stopped 20pt short of the right edge and the warm
 * corner read as a floating blob rather than light falling across the
 * whole card.
 */
export function HeroWarmGlow({ warm, ground }: { warm: string; ground: string }) {
  const gradientId = useId()
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' }}>
      <Defs>
        <RadialGradient id={gradientId} cx="86%" cy="8%" r="55%">
          <Stop offset="0" stopColor={warm} stopOpacity={0.35} />
          <Stop offset="1" stopColor={ground} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
  )
}
