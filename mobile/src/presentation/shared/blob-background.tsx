import { useId } from 'react'
import { Animated } from 'react-native'
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg'
import { BLOB_DRIFT_X_RANGE, BLOB_DRIFT_Y, useBlobDrift } from './hover.js'

const [BLOB_DRIFT_MIN, BLOB_DRIFT_MAX] = BLOB_DRIFT_X_RANGE

const BAND_HEIGHT = 520

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
 *
 * `useBlobDrift` moves the two color blobs a few points, slowly — the flat
 * `ground` fill underneath stays a separate, static layer on purpose: it
 * used to be inside the same animated group, which moved the *ground* (the
 * edge against the page's real background is what a moving flat fill reads
 * as) while the blobs — rigidly glued to that same rect — stayed visually
 * put relative to it. Two stacked `Svg`s rather than one, since a plain
 * `Animated.View` can wrap a whole SVG but not one Rect inside it.
 *
 * The gradient layer is also oversized to keep its own edges out of view
 * through the whole drift — and the two sides are cross-wired, which is
 * easy to get backwards (an earlier pass did): translating the layer
 * *right* by `BLOB_DRIFT_MAX` carries its *left* edge right by that same
 * amount, so it's the **left** overhang that has to absorb the rightward
 * travel (`-BLOB_DRIFT_MAX`, i.e. -60), and the **right** overhang that has
 * to absorb the leftward travel (`BLOB_DRIFT_MIN`, i.e. -10 — already
 * negative, used as-is). `height` is padded by `2 * BLOB_DRIFT_Y` and
 * re-centred with a matching negative `top`, same idea on the Y axis (there
 * symmetric, so no cross-wiring to get wrong). Undersized either overhang
 * and the layer's real edge slides into view on every cycle — a strip of
 * bare `ground` appearing/disappearing, which reads as the *page* shifting,
 * not the blob. Sized this way, the translated edge travels at most back to
 * where the band's real edge is — it never crosses inside — so only the
 * gradient's interior (the part that actually looks like a blob) is ever
 * visible moving.
 */
export function BlobBackground({ blobStrong, blobSoft, ground }: { blobStrong: string; blobSoft: string; ground: string }) {
  // useId(), not hardcoded strings — see AuthBlobBackground's comment in
  // identity/auth-blob-background.tsx for the collision this caused there
  // (same component mounted twice in one DOM under a Stack navigator).
  const id1 = useId()
  const id2 = useId()
  const drift = useBlobDrift()
  return (
    <>
      <Svg width="100%" height={BAND_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' }}>
        <Rect x="0" y="0" width="100%" height="100%" fill={ground} />
      </Svg>
      <Animated.View
        style={{
          position: 'absolute',
          top: -BLOB_DRIFT_Y,
          left: -BLOB_DRIFT_MAX,
          right: BLOB_DRIFT_MIN,
          height: BAND_HEIGHT + BLOB_DRIFT_Y * 2,
          pointerEvents: 'none',
          transform: drift.transform,
        }}
      >
        <Svg width="100%" height="100%">
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
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id2})`} />
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id1})`} />
        </Svg>
      </Animated.View>
    </>
  )
}
