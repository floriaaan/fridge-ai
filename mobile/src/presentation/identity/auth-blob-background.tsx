import { useId } from 'react'
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg'
import { useSoftPalette } from '../dashboard/soft-palette.js'

/**
 * Same two soft off-center radial blobs as the dashboard's `BlobBackground`,
 * so the whole app shares one ground.
 *
 * Ids are `useId()`-generated, not hardcoded strings, because sign-in and
 * sign-up both mount this component and both live in the same `(auth)`
 * Stack navigator, which keeps prior screens in the tree (for back-swipe)
 * rather than unmounting them — two `<RadialGradient id="authBlob1">`
 * elements in one DOM collide, and `fill="url(#authBlob1)"` resolves to
 * whichever one the browser picks, which is how sign-up rendered blank.
 */
export function AuthBlobBackground() {
  const palette = useSoftPalette()
  const id1 = useId()
  const id2 = useId()
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
      <Defs>
        <RadialGradient id={id1} cx="18%" cy="-8%" r="65%">
          <Stop offset="0" stopColor={palette.blobStrong} stopOpacity={0.85} />
          <Stop offset="0.5" stopColor={palette.blobSoft} stopOpacity={0.5} />
          <Stop offset="1" stopColor={palette.gradientBottom} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={id2} cx="92%" cy="100%" r="60%">
          <Stop offset="0" stopColor={palette.blobSoft} stopOpacity={0.7} />
          <Stop offset="1" stopColor={palette.gradientBottom} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={palette.gradientBottom} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id2})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id1})`} />
    </Svg>
  )
}
