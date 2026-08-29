import { useId } from 'react'
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg'

/**
 * Two soft, off-center radial-gradient blobs feathering into the ground
 * color — the "blob blurred" background the direction asked for, built
 * with `react-native-svg`'s `RadialGradient` (native + web, no platform
 * `filter: blur()`) rather than a flat top-to-bottom rectangle. Strong
 * color sits high and off-axis; both blobs dissolve to fully transparent
 * well before the bottom of the block, so the page reads mint → white,
 * never mint → dark.
 *
 * Shared across dashboard/recipe/shopping-list — moved here from
 * `dashboard/household-dashboard.tsx` (its original home) once other
 * bounded contexts started importing it from there.
 */
export function BlobBackground({ blobStrong, blobSoft, ground }: { blobStrong: string; blobSoft: string; ground: string }) {
  // useId(), not hardcoded strings — see AuthBlobBackground's comment in
  // identity/auth-blob-background.tsx for the collision this caused there
  // (same component mounted twice in one DOM under a Stack navigator).
  const id1 = useId()
  const id2 = useId()
  return (
    <Svg width="100%" height={520} style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' }}>
      <Defs>
        <RadialGradient id={id1} cx="28%" cy="-6%" r="62%">
          <Stop offset="0" stopColor={blobStrong} stopOpacity={0.9} />
          <Stop offset="0.5" stopColor={blobSoft} stopOpacity={0.55} />
          <Stop offset="1" stopColor={ground} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={id2} cx="88%" cy="14%" r="48%">
          <Stop offset="0" stopColor={blobSoft} stopOpacity={0.8} />
          <Stop offset="1" stopColor={ground} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={ground} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id2})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id1})`} />
    </Svg>
  )
}
