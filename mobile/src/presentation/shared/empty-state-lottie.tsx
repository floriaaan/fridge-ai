import LottieView from 'lottie-react-native'
import { useColorScheme } from 'react-native'
import { useReduceMotion } from './hover.js'

/**
 * A small looping illustration for a library's empty state — replaces the
 * flat icon on Recettes and Courses with the one authored moment the surface
 * earns: a pot with rising steam ("something's cooking, waiting for your
 * first recipe"), a cart bobbing under a pulsing "+" ("ready to be filled").
 * Hand-authored (no third-party Lottie file), monochrome `inkSecondary` only
 * — this is a decorative illustration, not the interactive/progress meaning
 * DESIGN.md reserves lime for.
 *
 * `colorFilters` (the runtime re-tint lottie-react-native offers on iOS/
 * Android) has no effect on the web renderer, so instead of one file plus a
 * color remap, each animation ships baked light/dark twins and this picks
 * between them — identical behaviour on every platform, no asymmetry to
 * account for later.
 */
const SOURCES = {
  recipes: {
    light: require('../../../assets/lottie/empty-recipes-light.json'),
    dark: require('../../../assets/lottie/empty-recipes-dark.json'),
  },
  'shopping-list': {
    light: require('../../../assets/lottie/empty-shopping-list-light.json'),
    dark: require('../../../assets/lottie/empty-shopping-list-dark.json'),
  },
} as const

export function EmptyStateLottie({
  animation,
  size = 96,
}: {
  animation: keyof typeof SOURCES
  size?: number
}) {
  const scheme = useColorScheme()
  const reduceMotion = useReduceMotion()
  const source = SOURCES[animation][scheme === 'dark' ? 'dark' : 'light']

  return (
    <LottieView
      source={source}
      style={{ width: size, height: size }}
      // Reduce Motion: hold the resting first frame instead of looping — the
      // same "state stays visible, travel stops" rule PulseDots and Skeleton
      // already follow.
      autoPlay={!reduceMotion}
      loop={!reduceMotion}
    />
  )
}
