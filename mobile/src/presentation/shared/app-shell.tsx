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
 * Three nav shapes:
 * — `{ kind: 'tab', tab, onScan }` for the four top-level sections
 *   (Accueil/Garde-manger/Recettes/Courses): mobile gets the glass pill + FAB,
 *   desktop gets the Sidebar with that tab highlighted.
 * — `{ kind: 'stack' }` for pushed detail screens (Réglages, Historique
 *   des tickets — not one of the four tabs): mobile carries no bottom
 *   nav (the screen renders its own BackButton in its header, same
 *   convention recipe/shopping-list already used), desktop still gets the
 *   Sidebar (DESIGN.md's tablet/desktop frame is universal, not
 *   per-screen-opt-in) but with nothing highlighted, since none of the
 *   four sections is "active" from a settings/receipts screen.
 * — `{ kind: 'modal' }` for a screen presented modally (the recipe
 *   composer). Same ground, safe area and content measure as the rest, but
 *   no bottom nav *and no Sidebar at any width*: a modal sits on top of the
 *   frame it was opened from, so re-drawing that frame's own navigation
 *   inside it offers a way out of a sheet that only Fermer should close.
 */
import { useState } from 'react'
import { Animated, Platform, Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { router } from 'expo-router'
import { Text, XStack, YStack } from './tamagui-typed.js'
import { pointerCursor, useReduceMotion } from './hover.js'
import { IS_ANDROID, materialRoles, ripple, surfaceShadow } from './material.js'
import { Sidebar, type SidebarSection } from './sidebar.js'
import { BlobBackground } from './blob-background.js'
import { pullToRefreshControl, type RefreshBinding } from './pull-to-refresh.js'
import { HintBubble } from './hint-bubble.js'
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
  frigo: 'Garde-manger',
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

export type AppShellNav =
  | { kind: 'tab'; tab: SidebarSection; onScan: () => void }
  | { kind: 'stack' }
  | { kind: 'modal' }

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
  /**
   * Pull-to-refresh for the shell's own ScrollView. Build it with
   * `usePullToRefresh(...)` from every query the screen displays. A screen
   * that owns its list (`scrollable={false}`) passes the control to that
   * list itself instead — see `pullToRefreshControl`.
   */
  refresh?: RefreshBinding
  /**
   * The screen's title block, pinned above the scroll area rather than
   * scrolled with the content. Always a `ScreenHeader`: every screen names
   * itself the same way, in the same place, and that name does not leave when
   * you scroll — which is what made a long fridge or a long receipt feel like
   * a page with no title at all.
   */
  header?: React.ReactNode
  children: React.ReactNode
}

/**
 * `.navigate`, not `.push`: pushing a tab switch stacked a history entry on
 * every hop, so Android's back button unwound the whole tab-hopping session
 * instead of leaving the app. `navigate` also happens to be the action iOS's
 * NativeBottomTabsRouter special-cases for jumping between tabs.
 */
function goToTab(tab: SidebarSection) {
  router.navigate(TAB_ROUTES[tab] as never)
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
    // Android's Material bar is 80dp of solid chrome plus its own safe-area
    // inset, with the FAB floating above it; the iOS/web pill floats over the
    // content and needs less.
    paddingBottom: hasMobileNav ? (IS_ANDROID ? 168 : 140) : 40,
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
      // The button opens a two-choice sheet; naming only one of them stated an
      // outcome the control does not deliver.
      accessibilityLabel="Scanner un produit ou un ticket de caisse"
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

/**
 * A Material 3 navigation-bar destination: a 32×64 pill "active indicator"
 * behind the icon only, the label always visible under it, 48dp of touch
 * height, and a bounded ripple. This is the shape M3 specifies, and it is
 * deliberately *not* the iOS/web pill above — the whole item does not fill
 * with colour, only the indicator behind the glyph does.
 */
function MaterialNavItem({ section, active }: { section: SidebarSection; active: boolean }) {
  const palette = useSoftPalette()
  const roles = materialRoles(palette)
  const color = active ? roles.onSecondaryContainer : roles.onSurfaceVariant
  return (
    <Pressable
      onPress={() => (active ? undefined : goToTab(section))}
      accessibilityRole="tab"
      accessibilityLabel={TAB_LABELS[section]}
      accessibilityState={{ selected: active }}
      android_ripple={ripple(roles.onSurfaceVariant, { borderless: true, radius: 40 })}
      style={{ flex: 1 }}
    >
      <YStack alignItems="center" justifyContent="center" gap={4} minHeight={48} paddingVertical={12}>
        <YStack
          width={64}
          height={32}
          borderRadius={16}
          alignItems="center"
          justifyContent="center"
          backgroundColor={active ? roles.secondaryContainer : 'transparent'}
        >
          {TAB_ICONS[section](color)}
        </YStack>
        <Text fontSize={12} fontWeight={active ? '700' : '500'} color={color}>
          {TAB_LABELS[section]}
        </Text>
      </YStack>
    </Pressable>
  )
}

/**
 * Android's bottom chrome, per Material 3: a full-width navigation bar on
 * `surfaceContainer` sitting flush to the bottom edge — not a floating
 * frosted pill, which is an iOS idiom the app was shipping to both platforms
 * (the audit's headline conformance finding). The FAB keeps its one job and
 * moves above the bar at the trailing edge, which is where M3 puts it.
 */
function MaterialTabNav({ tab, onScan }: { tab: SidebarSection; onScan: () => void }) {
  const palette = useSoftPalette()
  const roles = materialRoles(palette)
  return (
    <YStack position="absolute" left={0} right={0} bottom={0}>
      <YStack position="absolute" right={16} bottom={96}>
        <Fab onScan={onScan} />
      </YStack>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: roles.surfaceContainer }}>
        <XStack
          alignItems="center"
          justifyContent="space-around"
          backgroundColor={roles.surfaceContainer}
          minHeight={80}
          style={surfaceShadow(palette, 2, { offsetY: -2, opacity: 0.06, radius: 10 })}
        >
          {TAB_ORDER.map((section) => (
            <MaterialNavItem key={section} section={section} active={section === tab} />
          ))}
        </XStack>
      </SafeAreaView>
    </YStack>
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

export function AppShell({ nav, hint, contentMaxWidth = 640, scrollable = true, refresh, header, children }: AppShellProps) {
  const palette = useSoftPalette()
  const { isWide, hasMobileNav, isNativeTabBar } = useAppShellLayout(nav)
  const contentStyle = shellContentStyle({ isWide, hasMobileNav, contentMaxWidth })

  const content = (
    <YStack flex={1} minHeight={0} backgroundColor={palette.gradientBottom} style={{ position: 'relative' }}>
      <BlobBackground blobStrong={palette.blobStrong} blobSoft={palette.blobSoft} ground={palette.gradientBottom} />
      {/* `left`/`right` too: once the orientation lock came off, a landscape
          notch would otherwise eat the header's back button. */}
      <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={isWide ? ['left', 'right'] : ['top', 'bottom', 'left', 'right']}>
        {header ? <PinnedHeader contentStyle={contentStyle}>{header}</PinnedHeader> : null}
        {scrollable ? (
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{ ...contentStyle, paddingTop: header ? 4 : contentStyle.paddingTop }}
            refreshControl={refresh ? pullToRefreshControl(refresh, palette) : undefined}
          >
            {children}
          </ScrollView>
        ) : (
          <YStack flex={1} minHeight={0}>
            {children}
          </YStack>
        )}
      </SafeAreaView>
      {nav.kind === 'tab' && !isWide && !isNativeTabBar ? (
        IS_ANDROID ? (
          <MaterialTabNav tab={nav.tab} onScan={nav.onScan} />
        ) : (
          <MobileTabNav tab={nav.tab} onScan={nav.onScan} />
        )
      ) : null}
      <HintBubble hint={hint ?? null} palette={palette} />
    </YStack>
  )

  // A modal is already framed by the sheet it is presented in — it takes the
  // phone layout at every width, capped by the same content measure.
  if (!isWide || nav.kind === 'modal') return content

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
          onOpenReglages={() => router.push('/settings')}
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

/**
 * The pinned title block. It sits outside the ScrollView, takes the same
 * horizontal measure and max-width as the content below it so the title lines
 * up with the first card, and carries no fill of its own — the blob ground
 * shows through, exactly as it did when the header scrolled.
 *
 * No fill and no shadow: it was given `gradientBottom` plus a drop shadow to
 * separate it from the scrolling content, but the header is a sibling *above*
 * the ScrollView, not a layer over it — nothing ever passes under it to be
 * separated from. All the fill did was punch an opaque flat band across the
 * BlobBackground, which is the one thing the ground is there to show.
 */
function PinnedHeader({
  contentStyle,
  children,
}: {
  contentStyle: ReturnType<typeof shellContentStyle>
  children: React.ReactNode
}) {
  return (
    <YStack
      paddingHorizontal={contentStyle.paddingHorizontal}
      paddingTop={contentStyle.paddingTop}
      paddingBottom={12}
      width="100%"
      maxWidth={contentStyle.maxWidth}
      alignSelf={contentStyle.alignSelf ?? 'stretch'}
      style={{ zIndex: 2 }}
    >
      {children}
    </YStack>
  )
}
