/**
 * The one shared chrome for every screen — extracted after an audit found
 * BlobBackground + SafeAreaView + ScrollView + isWide/Sidebar wiring
 * copy-pasted independently across household-dashboard/fridge-list/
 * recipe-list/shopping-list (each slightly different: different
 * paddingBottom, different `edges`), while settings/receipts skipped the
 * shell entirely. Two real regressions this fixes:
 *
 * — the mobile bottom nav (glass pill + lime FAB) previously existed only
 *   on the dashboard screen; every other screen left the user with no
 *   persistent way back to another section except the OS back gesture.
 * — the BlurView glass pill was hardcoded `tint="light"`, so it stayed a
 *   light frosted pill even in dark mode. Fixed here, in one place.
 *
 * Two nav shapes:
 * — `{ kind: 'tab', tab, onScan }` for the four top-level sections
 *   (Accueil/Frigo/Recettes/Courses): mobile gets the glass pill + FAB,
 *   desktop gets the Sidebar with that tab highlighted.
 * — `{ kind: 'stack' }` for pushed detail screens (Réglages, Historique
 *   des tickets — not one of the four tabs): mobile carries no bottom
 *   nav (the screen renders its own BackButton in its header, same
 *   convention recipe/shopping-list already used), desktop still gets the
 *   Sidebar (DESIGN.md's tablet/desktop frame is universal, not
 *   per-screen-opt-in) but with nothing highlighted, since none of the
 *   four sections is "active" from a settings/receipts screen.
 */
import { useState } from 'react'
import { Animated, Platform, Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { router } from 'expo-router'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { pointerCursor, useReduceMotion } from './hover.js'
import { Sidebar, type SidebarSection } from './sidebar.js'
import { BlobBackground } from './blob-background.js'
import { HintBubble } from './hint-bubble.js'
import { useRegisterScanAction } from './scan-action-context.js'
import {
  ChefHatIcon,
  HomeIcon,
  PackageIcon,
  ScanLineIcon,
  ShoppingCartIcon,
} from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

export const TABLET_BREAKPOINT = 768

const TAB_LABELS: Record<SidebarSection, string> = {
  accueil: 'Accueil',
  frigo: 'Frigo',
  recettes: 'Recettes',
  courses: 'Courses',
}

const TAB_ROUTES: Record<SidebarSection, string> = {
  accueil: '/(tabs)',
  frigo: '/(tabs)/fridge',
  recettes: '/(tabs)/recipes',
  courses: '/(tabs)/shopping-list',
}

const TAB_ORDER: SidebarSection[] = ['accueil', 'frigo', 'recettes', 'courses']

const TAB_ICONS: Record<SidebarSection, (color: string) => React.ReactNode> = {
  accueil: (color) => <HomeIcon size={18} color={color} />,
  frigo: (color) => <PackageIcon size={18} color={color} />,
  recettes: (color) => <ChefHatIcon size={18} color={color} />,
  courses: (color) => <ShoppingCartIcon size={18} color={color} />,
}

export type AppShellNav = { kind: 'tab'; tab: SidebarSection; onScan: () => void } | { kind: 'stack' }

export interface AppShellProps {
  nav: AppShellNav
  hint?: string | null
  contentMaxWidth?: number
  /**
   * Default `true`: children render inside AppShell's own ScrollView.
   * Pass `false` when the screen owns a virtualized list (`FlatList`) as
   * its scroll container instead — nesting a FlatList inside AppShell's
   * ScrollView would defeat the virtualization it exists for. Pair with
   * `useAppShellLayout()` + `shellContentStyle()` so the list's own
   * `contentContainerStyle` matches every other screen's padding.
   */
  scrollable?: boolean
  children: React.ReactNode
}

function goToTab(tab: SidebarSection) {
  router.push(TAB_ROUTES[tab] as never)
}

/**
 * iOS gets the real `NativeTabs` bar (see `(tabs)/_layout.tsx`) — Liquid
 * Glass on iOS 26+, standard native chrome below that — so `AppShell` must
 * not also draw its own custom pill there. Android/web keep the BlurView
 * pill built in this file.
 */
const IS_NATIVE_TAB_PLATFORM = Platform.OS === 'ios'

/** Layout facts a screen needs to build its own scroll container against (see `scrollable={false}`). */
export function useAppShellLayout(nav: AppShellNav) {
  const { width } = useWindowDimensions()
  const isWide = width >= TABLET_BREAKPOINT
  const hasMobileNav = nav.kind === 'tab' && !isWide
  const isNativeTabBar = hasMobileNav && IS_NATIVE_TAB_PLATFORM
  return { isWide, hasMobileNav, isNativeTabBar }
}

/** The padding/max-width recipe every AppShell-driven scroll container shares. */
export function shellContentStyle({
  isWide,
  hasMobileNav,
  contentMaxWidth = 640,
}: {
  isWide: boolean
  hasMobileNav: boolean
  contentMaxWidth?: number
}) {
  return {
    paddingHorizontal: 20,
    paddingBottom: hasMobileNav ? 140 : 40,
    paddingTop: isWide ? 32 : 20,
    maxWidth: isWide ? contentMaxWidth : undefined,
    width: isWide ? ('100%' as const) : undefined,
    alignSelf: isWide ? ('center' as const) : undefined,
  }
}

/** Exported: also rendered inside iOS's `NativeTabs.BottomAccessory` (see `(tabs)/_layout.tsx`). */
export function Fab({ onScan }: { onScan: () => void }) {
  const palette = useSoftPalette()
  const reduceMotion = useReduceMotion()
  const [scale] = useState(() => new Animated.Value(1))
  function spring(toValue: number, friction: number, tension: number) {
    if (reduceMotion) {
      Animated.timing(scale, { toValue, duration: 0, useNativeDriver: true }).start()
      return
    }
    Animated.spring(scale, { toValue, friction, tension, useNativeDriver: true }).start()
  }
  return (
    <Pressable
      onPress={onScan}
      onHoverIn={() => spring(1.06, 6, 200)}
      onHoverOut={() => spring(1, 5, 160)}
      onPressIn={() => spring(0.86, 5, 200)}
      onPressOut={() => spring(1, 4, 160)}
      testID="scan-fab"
      accessibilityRole="button"
      accessibilityLabel="Scanner un produit"
      style={pointerCursor}
    >
      <Animated.View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: palette.accentLime,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
          shadowColor: palette.shadowCool,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.28,
          shadowRadius: 16,
          elevation: 6,
        }}
      >
        <ScanLineIcon size={24} color={palette.accentLimeText} />
      </Animated.View>
    </Pressable>
  )
}

function TabBarItem({ section, active }: { section: SidebarSection; active: boolean }) {
  const palette = useSoftPalette()
  const color = active ? palette.accentLimeText : palette.inkSecondary
  return (
    <Pressable
      onPress={() => (active ? undefined : goToTab(section))}
      accessibilityRole="button"
      accessibilityLabel={TAB_LABELS[section]}
      accessibilityState={{ selected: active }}
      style={pointerCursor}
    >
      {/* minHeight 44: touch-target floor, same convention as Sidebar's SidebarItem. */}
      <YStack
        alignItems="center"
        justifyContent="center"
        gap="$1"
        minHeight={44}
        minWidth={52}
        paddingVertical="$1.5"
        paddingHorizontal="$2"
        borderRadius={999}
        backgroundColor={active ? palette.accentLime : 'transparent'}
      >
        {TAB_ICONS[section](color)}
        <Text fontSize={10} fontWeight="700" color={color}>
          {TAB_LABELS[section]}
        </Text>
      </YStack>
    </Pressable>
  )
}

function MobileTabNav({ tab, onScan }: { tab: SidebarSection; onScan: () => void }) {
  const palette = useSoftPalette()
  return (
    <YStack position="absolute" left={0} right={0} bottom={0} alignItems="center" paddingBottom={18}>
      <XStack alignItems="center" gap="$3" width="92%" justifyContent="space-between">
        <BlurView
          intensity={40}
          tint={palette.blurTint}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          {TAB_ORDER.map((section) => (
            <TabBarItem key={section} section={section} active={section === tab} />
          ))}
        </BlurView>
        <Fab onScan={onScan} />
      </XStack>
    </YStack>
  )
}

export function AppShell({ nav, hint, contentMaxWidth = 640, scrollable = true, children }: AppShellProps) {
  const palette = useSoftPalette()
  const { isWide, hasMobileNav, isNativeTabBar } = useAppShellLayout(nav)
  useRegisterScanAction(nav.kind === 'tab' ? nav.onScan : null, nav.kind === 'tab' ? TAB_ROUTES[nav.tab] : null)

  const content = (
    <YStack flex={1} minHeight={0} backgroundColor={palette.gradientBottom} style={{ position: 'relative' }}>
      <BlobBackground blobStrong={palette.blobStrong} blobSoft={palette.blobSoft} ground={palette.gradientBottom} />
      <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={isWide ? [] : ['top', 'bottom']}>
        {scrollable ? (
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={shellContentStyle({ isWide, hasMobileNav, contentMaxWidth })}
          >
            {children}
          </ScrollView>
        ) : (
          <YStack flex={1} minHeight={0}>
            {children}
          </YStack>
        )}
      </SafeAreaView>
      {nav.kind === 'tab' && !isWide && !isNativeTabBar ? <MobileTabNav tab={nav.tab} onScan={nav.onScan} /> : null}
      <HintBubble hint={hint ?? null} palette={palette} />
    </YStack>
  )

  if (!isWide) return content

  const activeTab = nav.kind === 'tab' ? nav.tab : undefined

  return (
    <SafeAreaView style={{ flex: 1, minHeight: 0, backgroundColor: palette.layoutSurface }} edges={['top', 'bottom']}>
      <XStack flex={1} minHeight={0} backgroundColor={palette.layoutSurface}>
        <Sidebar
          palette={palette}
          active={activeTab}
          onOpenAccueil={() => (activeTab === 'accueil' ? undefined : goToTab('accueil'))}
          onOpenFrigo={() => (activeTab === 'frigo' ? undefined : goToTab('frigo'))}
          onOpenRecettes={() => (activeTab === 'recettes' ? undefined : goToTab('recettes'))}
          onOpenCourses={() => (activeTab === 'courses' ? undefined : goToTab('courses'))}
          onScan={nav.kind === 'tab' ? nav.onScan : () => goToTab('accueil')}
        />
        <YStack flex={1} minHeight={0} padding="$4" style={{ position: 'relative' }}>
          <YStack
            flex={1}
            minHeight={0}
            overflow="hidden"
            style={{
              borderRadius: 28,
              shadowColor: palette.shadowWarm,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.16,
              shadowRadius: 22,
              elevation: 4,
            }}
          >
            {content}
          </YStack>
        </YStack>
      </XStack>
    </SafeAreaView>
  )
}
