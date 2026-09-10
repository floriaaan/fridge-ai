import type { ReactNode } from 'react'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { AuthScreenChrome } from './auth-screen-chrome.js'

/**
 * The shared shell for sign-in/sign-up: blob ground, carrot+wordmark
 * branding, one white asymmetric-radius card holding the form — centered
 * and width-capped on every screen size instead of a full-bleed column,
 * which is what "stretched to a 1440px browser window" actually looked
 * like before this pass.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  const palette = useSoftPalette()
  return (
    <AuthScreenChrome maxWidth={400}>
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
    </AuthScreenChrome>
  )
}
