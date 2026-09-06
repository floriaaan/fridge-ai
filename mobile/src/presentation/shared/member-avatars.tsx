/**
 * Up to three overlapping initials, then a "+N" disc — the foyer made visible.
 *
 * It lived in `settings/identity-card.tsx` and rendered in exactly one place:
 * Réglages → Foyer, two taps in, on a screen nobody opens. The one thing that
 * separates this product from a personal fridge tracker is that several people
 * share the shelf, and it was invisible everywhere the product is actually
 * used. It sits in `shared/` now because the dashboard shows it too.
 */
import { Text, XStack, YStack } from './tamagui-typed.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

export function MemberAvatars({
  names,
  palette,
  max = 3,
}: {
  names: readonly string[]
  palette: SoftPalette
  max?: number
}) {
  if (names.length === 0) return null
  const shown = names.slice(0, max)
  const rest = names.length - shown.length

  return (
    <XStack alignItems="center" gap="$2">
      <XStack alignItems="center">
        {shown.map((name, index) => (
          <YStack
            key={`${name}-${index}`}
            width={26}
            height={26}
            borderRadius={999}
            // navCardTeal, not chipTeal: this disc carries white *text*, and
            // the chip siblings measure under 4.5:1 against white.
            backgroundColor={palette.navCardTeal}
            alignItems="center"
            justifyContent="center"
            marginLeft={index === 0 ? 0 : -8}
          >
            <Text fontSize={11} fontWeight="800" color={palette.onDark}>
              {initials(name)}
            </Text>
          </YStack>
        ))}
        {rest > 0 ? (
          <YStack width={26} height={26} borderRadius={999} backgroundColor={palette.gradientBottom} alignItems="center" justifyContent="center" marginLeft={-8}>
            <Text fontSize={11} fontWeight="800" color={palette.mintPaleText}>
              +{rest}
            </Text>
          </YStack>
        ) : null}
      </XStack>
    </XStack>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
