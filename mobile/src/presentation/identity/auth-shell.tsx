import type { ReactNode } from 'react'
import { Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { AuthBlobBackground } from './auth-blob-background.js'

const carrotIllustration = require('../../../assets/illustrations/carrot-3d.png')

/**
 * The shared shell for sign-in/sign-up: blob ground, carrot+wordmark
 * branding, one white asymmetric-radius card holding the form — centered
 * and width-capped on every screen size instead of a full-bleed column,
 * which is what "stretched to a 1440px browser window" actually looked
 * like before this pass.
 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const palette = useSoftPalette()
  return (
    <YStack flex={1} minHeight={0} backgroundColor={palette.gradientBottom} style={{ position: 'relative' }}>
      <AuthBlobBackground />
      <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={['top', 'bottom']}>
        {/* KeyboardAvoidingView: without it, the keyboard covered the
            submit button / PocketID row on real devices — a real gap the
            audit caught (no keyboard handling existed on either auth
            screen). 'padding' behavior on iOS, none needed on Android
            (which resizes the window by default). */}
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
            <YStack width="100%" maxWidth={400} gap="$5" alignItems="center">
              <XStack alignItems="center" gap="$2">
                <Image source={carrotIllustration} style={{ width: 36, height: 36 }} resizeMode="contain" accessibilityLabel="" />
                <Text fontSize={16} fontWeight="800" letterSpacing={1} color={palette.ink}>
                  FRIDGE AI
                </Text>
              </XStack>

              <YStack
                width="100%"
                backgroundColor={palette.gradientBottom}
                padding="$5"
                gap="$4"
                style={{
                  borderTopLeftRadius: 32,
                  borderTopRightRadius: 20,
                  borderBottomRightRadius: 32,
                  borderBottomLeftRadius: 20,
                  shadowColor: palette.shadowWarm,
                  shadowOffset: { width: 0, height: 18 },
                  shadowOpacity: 0.12,
                  shadowRadius: 30,
                  elevation: 4,
                }}
              >
                <YStack gap="$1">
                  <Text fontSize={20} fontWeight="800" color={palette.ink}>
                    {title}
                  </Text>
                  <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
                    {subtitle}
                  </Text>
                </YStack>
                {children}
              </YStack>
            </YStack>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </YStack>
  )
}
