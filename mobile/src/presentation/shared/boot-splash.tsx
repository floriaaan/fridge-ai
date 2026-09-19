/**
 * What the route gates (`(tabs)`, `(auth)`, `(onboarding)`) render while the
 * session / foyer answer is pending, instead of `null` — which was a blank
 * screen for as long as a slow or unreachable server took to answer.
 */
import { YStack } from './tamagui-typed.js'
import { PulseDots } from './pulse-dots.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

export function BootSplash() {
  const palette = useSoftPalette()
  return (
    <YStack testID="boot-splash" flex={1} alignItems="center" justifyContent="center" backgroundColor={palette.gradientTop}>
      <PulseDots palette={palette} size={12} />
    </YStack>
  )
}
