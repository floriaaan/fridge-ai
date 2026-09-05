import type { ReactNode } from 'react'
import { YStack } from './tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

/**
 * The white asymmetric-radius card `AuthShell` wraps sign-in/sign-up in —
 * extracted here so the other data-entry forms (product, shopping item,
 * receipt review) sit on the same "one card on the blob ground" material
 * instead of loose fields floating directly on the background, which is
 * what every non-auth form looked like before this pass. Same exact
 * radius/shadow recipe as `AuthShell`'s card — literally the same card,
 * not a lookalike.
 */
export function FormCard({
  palette,
  gap = '$4',
  children,
}: {
  palette: SoftPalette
  gap?: '$3' | '$4'
  children: ReactNode
}) {
  return (
    <YStack
      width="100%"
      backgroundColor={palette.gradientBottom}
      padding="$5"
      gap={gap}
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
      {children}
    </YStack>
  )
}
