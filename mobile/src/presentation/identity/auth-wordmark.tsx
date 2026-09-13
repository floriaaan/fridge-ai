/**
 * The carrot+"FRIDGE AI" lockup — shared by `AuthScreenChrome` (the
 * threshold's blob ground, `tone="ink"`) and `AuthShell` (sign-in/sign-up's
 * photo ground, `tone="on-dark"`). Pulled out once a second copy of it was
 * about to exist with the only difference being which palette token the
 * label used.
 */
import { Image } from 'react-native'
import { Text, XStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

const carrotIllustration = require('../../../assets/illustrations/carrot-3d.png')

export function AuthWordmark({ tone }: { tone: 'ink' | 'on-dark' }) {
  const palette = useSoftPalette()
  return (
    <XStack alignItems="center" gap="$2" alignSelf="center">
      <Image source={carrotIllustration} style={{ width: 36, height: 36 }} resizeMode="contain" accessibilityLabel="" />
      <Text fontSize={16} fontWeight="800" letterSpacing={1} color={tone === 'on-dark' ? palette.onDark : palette.ink}>
        FRIDGE AI
      </Text>
    </XStack>
  )
}
