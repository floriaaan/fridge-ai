/**
 * The "bientôt disponible" toast pattern, shared: any tap with no real
 * destination yet surfaces an honest hint instead of doing nothing — see
 * household-dashboard.tsx's own (inline) copy of this idea. Extracted
 * here so new screens don't reinvent it or, worse, ship a silent no-op.
 */
import { useState } from 'react'
import { Text, YStack } from './tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export function useHint(): [string | null, (message: string) => void] {
  const [hint, setHint] = useState<string | null>(null)
  return [hint, setHint]
}

export function HintBubble({ hint, palette }: { hint: string | null; palette: SoftPalette }) {
  if (!hint) return null
  return (
    <YStack
      position="absolute"
      left={0}
      right={0}
      bottom={18}
      alignItems="center"
      style={{ pointerEvents: 'none' }}
    >
      <YStack backgroundColor={palette.brandDeep} borderRadius={999} paddingVertical="$1.5" paddingHorizontal="$4">
        <Text fontSize={12} fontWeight="600" color={palette.brandDeepText}>
          {hint}
        </Text>
      </YStack>
    </YStack>
  )
}
