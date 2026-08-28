/**
 * Tablet/desktop-only persistent nav — extracted from household-dashboard
 * so Recettes/Courses can share the exact same sidebar (and stay
 * highlighted as "active") instead of the sidebar only existing on the
 * Frigo screen and vanishing everywhere else, which would have been a
 * worse regression than the extra file.
 */
import { Animated, Image, Pressable } from 'react-native'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { pointerCursor, useHoverPress } from './hover.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ChefHatIcon, FlameIcon, PackageIcon, ScanLineIcon, ShoppingCartIcon } from '../dashboard/dashboard-icons.js'

const carrotIllustration = require('../../../assets/illustrations/carrot-3d.png')

export type SidebarSection = 'frigo' | 'recettes' | 'courses'

/** One row in the sidebar — hover/press feedback, active state in lime. */
function SidebarItem({
  active,
  icon,
  label,
  onPress,
  palette,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onPress: () => void
  palette: SoftPalette
}) {
  const hover = useHoverPress()
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        {/* minHeight 44: an audit-caught touch-target floor, not a style nit. */}
        <XStack
          alignItems="center"
          gap="$2.5"
          paddingVertical="$2.5"
          paddingHorizontal="$3"
          minHeight={44}
          backgroundColor={active ? palette.accentLime : 'transparent'}
          borderRadius={999}
        >
          {icon}
          <Text fontSize={13} fontWeight="700" color={active ? palette.accentLimeText : palette.ink}>
            {label}
          </Text>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}

export function Sidebar({
  palette,
  streakDays,
  active,
  onOpenFrigo,
  onOpenRecettes,
  onOpenCourses,
  onScan,
}: {
  palette: SoftPalette
  streakDays: number
  active: SidebarSection
  onOpenFrigo: () => void
  onOpenRecettes: () => void
  onOpenCourses: () => void
  onScan: () => void
}) {
  const scanHover = useHoverPress()
  return (
    // No radius/shadow of its own on purpose: this is the left region of
    // one single rounded frame (see the wide-layout return in whichever
    // screen renders this), not a separate floating card next to another
    // one — the frame's own `overflow:hidden` + borderRadius rounds this
    // panel's outer corners for free.
    <YStack width={220} alignSelf="stretch" padding="$4" gap="$5" backgroundColor={palette.layoutSurface}>
      <XStack alignItems="center" gap="$2">
        <Image source={carrotIllustration} style={{ width: 28, height: 28 }} resizeMode="contain" accessibilityLabel="" />
        <Text fontSize={14} fontWeight="800" letterSpacing={1} color={palette.ink}>
          FRIDGE AI
        </Text>
      </XStack>

      <XStack
        alignItems="center"
        gap="$1.5"
        alignSelf="flex-start"
        backgroundColor={palette.accentWarm}
        paddingVertical="$1.5"
        paddingHorizontal="$3"
        borderRadius={999}
        style={{ transform: [{ rotate: '-3deg' }] }}
      >
        <FlameIcon size={13} color={palette.accentWarmText} />
        <Text fontSize={11} fontWeight="800" color={palette.accentWarmText}>
          {streakDays}j sans gaspi
        </Text>
      </XStack>

      <YStack gap="$1.5">
        <SidebarItem
          active={active === 'frigo'}
          icon={<PackageIcon size={17} color={active === 'frigo' ? palette.accentLimeText : palette.inkSecondary} />}
          label="Frigo"
          onPress={onOpenFrigo}
          palette={palette}
        />
        <SidebarItem
          active={active === 'recettes'}
          icon={<ChefHatIcon size={17} color={active === 'recettes' ? palette.accentLimeText : palette.inkSecondary} />}
          label="Recettes"
          onPress={onOpenRecettes}
          palette={palette}
        />
        <SidebarItem
          active={active === 'courses'}
          icon={<ShoppingCartIcon size={17} color={active === 'courses' ? palette.accentLimeText : palette.inkSecondary} />}
          label="Courses"
          onPress={onOpenCourses}
          palette={palette}
        />
      </YStack>

      <YStack flex={1} />

      <Pressable
        onPress={onScan}
        onHoverIn={scanHover.onHoverIn}
        onHoverOut={scanHover.onHoverOut}
        onPressIn={scanHover.onPressIn}
        onPressOut={scanHover.onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Scanner un produit"
        style={pointerCursor}
      >
        <Animated.View style={{ transform: [{ scale: scanHover.scale }] }}>
          <XStack
            alignItems="center"
            justifyContent="center"
            gap="$2"
            backgroundColor={palette.accentLime}
            paddingVertical="$3"
            borderRadius={999}
          >
            <ScanLineIcon size={16} color={palette.accentLimeText} />
            <Text fontSize={13} fontWeight="800" color={palette.accentLimeText}>
              Scanner
            </Text>
          </XStack>
        </Animated.View>
      </Pressable>
    </YStack>
  )
}
