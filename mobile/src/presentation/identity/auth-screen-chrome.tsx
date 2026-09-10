import type { ReactNode } from 'react'
import { Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { AuthBlobBackground } from './auth-blob-background.js'

const carrotIllustration = require('../../../assets/illustrations/carrot-3d.png')

/**
 * The chrome every pre-household screen shares: blob ground, safe area,
 * keyboard-avoiding scroll, and the carrot+wordmark lockup above the content.
 * Sign-in, sign-up (through `AuthShell`) and the threshold each wrap a
 * different card shape in it — one title+card, two unequal branch cards — so
 * this owns only what stays identical between them. It used to be typed out
 * three times; a keyboard offset or a scroll prop fixed in one copy and not
 * the others is exactly the kind of drift `AppShell` was extracted to stop
 * happening to the tab screens.
 */
export function AuthScreenChrome({
  maxWidth,
  overlay,
  children,
}: {
  /** The lockup+content column's cap — narrower for a single card, wider for two. */
  maxWidth: number
  /**
   * Rendered as a sibling of the safe area, inside the outer `position:
   * relative` flex fill — not inside the scroll content. A `HintBubble`
   * positions itself `absolute` against that fill; nested inside the
   * scrolling column instead, it would anchor to the content height rather
   * than the screen.
   */
  overlay?: ReactNode
  children: ReactNode
}) {
  const palette = useSoftPalette()
  return (
    <YStack
      flex={1}
      minHeight={0}
      backgroundColor={palette.gradientBottom}
      style={{ position: 'relative' }}
    >
      <AuthBlobBackground />
      <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1, minHeight: 0 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingVertical: 32,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <YStack width="100%" maxWidth={maxWidth} gap="$5">
              <XStack alignItems="center" gap="$2" alignSelf="center">
                <Image
                  source={carrotIllustration}
                  style={{ width: 36, height: 36 }}
                  resizeMode="contain"
                  accessibilityLabel=""
                />
                <Text fontSize={16} fontWeight="800" letterSpacing={1} color={palette.ink}>
                  FRIDGE AI
                </Text>
              </XStack>
              {children}
            </YStack>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {overlay}
    </YStack>
  )
}
