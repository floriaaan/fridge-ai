/*
 * The destination of iOS's floating "search"-role tab (see
 * `(tabs)/_layout.tsx`), and a real screen rather than a trick.
 *
 * It used to render `null` and run whichever tab had registered an `onScan`
 * handler through a ref-backed context, then bounce back. From a pushed
 * screen nothing was registered, so tapping Scanner teleported the user to
 * the home screen; from Accueil it opened a sheet over a blank white tab
 * and dismissing it left the user staring at that blank tab with "Scanner"
 * selected. Four commits tried to patch that indirection. A tab that owns
 * a screen needs none of it: the two choices are the screen.
 */
import { Animated, Pressable } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { goToProductScan, goToReceiptScan } from '../shared/scan-sheet.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ReceiptIcon, ScanLineIcon } from '../dashboard/dashboard-icons.js'

export function ScanScreen() {
  const palette = useSoftPalette()

  return (
    <AppShell nav={{ kind: 'stack' }}>
      <YStack gap="$2">
        <Text fontSize={20} fontWeight="800" color={palette.ink}>
          Scanner
        </Text>
        <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
          Remplis le frigo sans rien taper.
        </Text>
      </YStack>

      <YStack gap="$3" marginTop="$6">
        <ScanChoice
          testID="scan-screen-product"
          title="Un produit"
          subtitle="Le code-barres remplit le nom et la catégorie."
          icon={<ScanLineIcon size={22} color={palette.onDark} />}
          tint={palette.navCardTeal}
          corner="a"
          onPress={goToProductScan}
          palette={palette}
        />
        <ScanChoice
          testID="scan-screen-receipt"
          title="Un ticket de caisse"
          subtitle="L’IA en extrait tous les produits d’un coup."
          icon={<ReceiptIcon size={22} color={palette.onDark} />}
          tint={palette.navCardViolet}
          corner="b"
          onPress={goToReceiptScan}
          palette={palette}
        />
      </YStack>
    </AppShell>
  )
}

function ScanChoice({
  testID,
  title,
  subtitle,
  icon,
  tint,
  corner,
  onPress,
  palette,
}: {
  testID: string
  title: string
  subtitle: string
  icon: React.ReactNode
  tint: string
  corner: 'a' | 'b'
  onPress: () => void
  palette: SoftPalette
}) {
  const hover = useHoverPress()
  const radii =
    corner === 'a'
      ? { borderTopLeftRadius: 28, borderTopRightRadius: 16, borderBottomRightRadius: 28, borderBottomLeftRadius: 16 }
      : { borderTopLeftRadius: 16, borderTopRightRadius: 28, borderBottomRightRadius: 16, borderBottomLeftRadius: 28 }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${subtitle}`}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack
          alignItems="center"
          gap="$4"
          padding="$4"
          backgroundColor={tint}
          style={{
            ...radii,
            shadowColor: palette.shadowCool,
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.22,
            shadowRadius: 28,
            elevation: 6,
          }}
        >
          <YStack width={48} height={48} borderRadius={16} backgroundColor="rgba(255,255,255,0.18)" alignItems="center" justifyContent="center">
            {icon}
          </YStack>
          <YStack flex={1} gap="$1">
            <Text fontSize={16} fontWeight="800" color={palette.onDark}>
              {title}
            </Text>
            <Text fontSize={12} fontWeight="500" color={palette.onDark} opacity={0.85}>
              {subtitle}
            </Text>
          </YStack>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
