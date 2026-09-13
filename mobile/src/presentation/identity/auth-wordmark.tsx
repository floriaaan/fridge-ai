/**
 * The mascot+"GARDE-MANGER" lockup — shared by `AuthScreenChrome` (the
 * threshold's blob ground, `tone="ink"`) and `AuthShell` (sign-in/sign-up's
 * photo ground, `tone="on-dark"`). Pulled out once a second copy of it was
 * about to exist with the only difference being which palette token the
 * label used.
 */
import { Image } from 'react-native'
import { Text, XStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

const mascotIllustration = require('../../../assets/mascot.png')

export function AuthWordmark({ tone }: { tone: 'ink' | 'on-dark' }) {
  const palette = useSoftPalette()
  return (
    <XStack alignItems="center" gap="$2" alignSelf="center">
      {/* 56, not the carrot glyph's old 36 — the mascot is a full character
          (face, arms, a held leaf), not a simple icon shape, and needs more
          pixels than a flat glyph to read as anything at this size. */}
      <Image source={mascotIllustration} style={{ width: 56, height: 56 }} resizeMode="contain" accessibilityLabel="" />
      <Text fontSize={16} fontWeight="800" letterSpacing={1} color={tone === 'on-dark' ? palette.onDark : palette.ink}>
        GARDE-MANGER
      </Text>
    </XStack>
  )
}
