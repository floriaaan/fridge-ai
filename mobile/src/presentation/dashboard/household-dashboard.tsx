/*
 * DIRECTION CONTRACT — dashboard foyer (redesign, 2026-08-27; pushed
 * toward Material Expressive same day per follow-up feedback)
 *
 * User-pinned world, replacing the previously built "ticket de caisse"
 * direction outright (a pin beats the roll — new-work.md §"Commit the
 * world"). Not a concept-seed roll: the user supplied the full visual
 * vocabulary, mapped component-by-component onto the fridge domain, then
 * asked for more color/motion/expressive shape once the first pass read
 * as too quiet/sage.
 *
 * THESIS: the shared fridge reads as a soft, gamified progress dashboard —
 * one high-contrast dark hero the eye lands on first, everything else
 * pastel, asymmetric and floating, habit-app register applied to food
 * waste instead of streaks and lessons.
 * OWN-WORLD: mint-to-white radial "blob" ground (two soft off-center
 * gradients dissolving to white, never a flat top-to-bottom bar); one
 * warm-dark hero card (umber, not cold forest-black — an ember glow in
 * one corner), asymmetric-radius, as the surface's sole high-contrast
 * block; lime reserved for interactive/progress elements;
 * a second bold hue (warm orange) on the streak badge, tilted like a
 * decal; three pastel stat cards (cream/lavender/pale-mint) each with its
 * own asymmetric corner set and a solid saturated icon chip (orange /
 * violet / teal) instead of a bare icon; full-pill badges, wide
 * low-opacity floating shadows, no visible borders; one geometric sans,
 * hierarchy by size+weight only; status still redundantly icon+color
 * (mint/amber/coral), kept from the previous world's accessibility raise.
 * STORY: a foyer member opens the app, reads the hero in one glance
 * ("3 produits à surveiller"), scans the pastel stats, then either jumps
 * to Recettes/Courses (the two things they'd actually tap next) or
 * glances the 2-line "périme bientôt" preview — the home page is a
 * synthesis-and-navigation hub, not an expiry log with two footnotes.
 * FIRST VIEWPORT: a small transparent carrot illustration beside the
 * greeting (no background chip — two earlier rounds tried it as a boxed
 * tile above and inside the hero; both read as a separate component
 * rather than personality attached to the person you're greeting) +
 * tilted warm streak badge + quiet sign-out link, spring-entrance warm
 * hero card (ember glow corner) with headline + two status pills, three
 * asymmetric pastel stat cards, then "Accès rapide" — two big
 * saturated NavCards (Recettes / Courses) at the same visual weight as
 * the hero — then a deliberately small "Périme bientôt" preview (top 2
 * items + "Voir tout"), closed by a floating glass pill (current
 * surface) and a lime FAB that scales down on press (the signature
 * interaction) before scanning a product. Every tap that has no real
 * destination yet (NavCards, FAB, "Voir tout") surfaces the same honest
 * "bientôt disponible" hint rather than a dead control. Product status
 * (in the "Périme bientôt" preview) is a colored+labeled pill, not just
 * an icon — same redundant icon+color+word signal, more legible at a
 * glance. Every Pressable spring-scales on hover (web) and press (all
 * platforms) via `useHoverPress`. At ≥768px width the phone's floating
 * pill+FAB are replaced by a persistent playful sidebar (nav + streak +
 * a lime "Scanner" button, same warm-hero material) and the whole
 * dashboard becomes a rounded "insert" panel beside it — a two-pane
 * layout, not the phone layout stretched wide.
 * FORM: user-pinned direction, no concept-seed roll.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with
 * the finish review, the verdict, DESIGN.md, and every shipping raster
 * carrying its provenance.
 *
 * DISCLOSED GAPS:
 * — 3D illustrations: the hero and both NavCards now carry real 3D
 *   renders (Microsoft Fluent Emoji 3D, MIT — carrot / pot-of-food /
 *   shopping-cart, see assets/illustrations/NOTICE.md) behind the glow,
 *   found by web search once image generation turned out unavailable
 *   this session. They're a found match, not the product's own
 *   commissioned set — swap for real product photography/illustration
 *   when that exists. Any *other* illustration slot added later without
 *   a matching asset still falls back to `IllustrationSlot`'s flat
 *   icon + "3D · bientôt" tag rather than shipping empty.
 * — Dark mode: `useSoftPalette` is light-only on purpose right now — see
 *   soft-palette.ts's header comment for why (the naive dark palette
 *   read as "mint→dark green", which is what triggered this round of
 *   feedback in the first place).
 *
 * Data is synthetic — see dashboard.fixture.ts. `streakDays` in
 * particular has no MVP concept behind it at all (invented to prove the
 * gamified badge) — flag before this ships past a design pass.
 */
import { useEffect, useId, useMemo, useState } from 'react'
import { Animated, Image, type ImageSourcePropType, Pressable, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg'
import { ScrollView } from 'tamagui'
import {
  ChefHatIcon,
  CircleCheckIcon,
  CircleXIcon,
  FlameIcon,
  PackageIcon,
  ScanLineIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  WalletIcon,
} from './dashboard-icons.js'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress, useReduceMotion } from '../shared/hover.js'
import { Sidebar } from '../shared/sidebar.js'
import { useSoftPalette, type SoftPalette } from './soft-palette.js'
import { dashboardFixture, expiryLabel, type ProductStatus } from './dashboard.fixture.js'

// Real 3D illustrations — Microsoft Fluent Emoji 3D (MIT license), bundled
// locally rather than fetched from a CDN at runtime (this app makes no
// direct client→external-service calls by design — see PRODUCT.md).
// Attribution: assets/illustrations/NOTICE.md.
const carrotIllustration = require('../../../assets/illustrations/carrot-3d.png') as ImageSourcePropType
const potOfFoodIllustration = require('../../../assets/illustrations/pot-of-food-3d.png') as ImageSourcePropType
const shoppingCartIllustration = require('../../../assets/illustrations/shopping-cart-3d.png') as ImageSourcePropType

function StatusIcon({ status, size, color }: { status: ProductStatus; size: number; color: string }) {
  if (status === 'expired') return <CircleXIcon size={size} color={color} />
  if (status === 'soon') return <TriangleAlertIcon size={size} color={color} />
  return <CircleCheckIcon size={size} color={color} />
}

function statusLabel(status: ProductStatus): string {
  return status === 'expired' ? 'Expiré' : status === 'soon' ? 'Bientôt' : 'Frais'
}

/** A small colored pill carrying the product's status as icon + word, not color alone. */
function StatusChip({ status, bg, color }: { status: ProductStatus; bg: string; color: string }) {
  return (
    <XStack alignItems="center" gap="$1" backgroundColor={bg} borderRadius={999} paddingVertical="$0.5" paddingHorizontal="$2">
      <StatusIcon status={status} size={11} color={color} />
      <Text fontSize={10} fontWeight="700" color={color}>
        {statusLabel(status)}
      </Text>
    </XStack>
  )
}

function StatCard({
  bg,
  labelColor,
  valueColor,
  chipColor,
  icon,
  label,
  value,
  corner,
  palette,
}: {
  bg: string
  labelColor: string
  valueColor: string
  chipColor: string
  icon: React.ReactNode
  label: string
  value: string
  corner: 'a' | 'b' | 'c'
  palette: SoftPalette
}) {
  // Three slightly different asymmetric corner sets so the row of pastel
  // cards reads as expressive/organic rather than three identical stamps.
  const radii =
    corner === 'a'
      ? { borderTopLeftRadius: 26, borderTopRightRadius: 14, borderBottomRightRadius: 26, borderBottomLeftRadius: 14 }
      : corner === 'b'
        ? { borderTopLeftRadius: 14, borderTopRightRadius: 26, borderBottomRightRadius: 14, borderBottomLeftRadius: 26 }
        : { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomRightRadius: 14, borderBottomLeftRadius: 14 }

  return (
    <YStack
      flex={1}
      backgroundColor={bg}
      padding="$4"
      gap="$2"
      style={{ ...radii, shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 3 }}
    >
      <YStack width={36} height={36} borderRadius={12} backgroundColor={chipColor} alignItems="center" justifyContent="center">
        {icon}
      </YStack>
      <YStack>
        <Text fontSize={12} fontWeight="500" color={labelColor}>
          {label}
        </Text>
        <Text fontSize={22} fontWeight="800" color={valueColor} marginTop="$1">
          {value}
        </Text>
      </YStack>
    </YStack>
  )
}

/**
 * The illustration area above each big tile's title — a soft blurred
 * radial-gradient glow (same technique as `BlobBackground`) behind either
 * a real 3D illustration (`imageSource`, a bundled asset) or, failing
 * that, a flat icon tagged as a placeholder. Real 3D renders: Microsoft's
 * Fluent Emoji 3D set (MIT-licensed) — see assets/illustrations/NOTICE.md.
 *
 * Clipping is belt-and-suspenders (`overflow` prop + `style.overflow` +
 * matching `style` border radius): react-native-web's default SVG root
 * doesn't always inherit a parent View's `overflow:hidden` the way native
 * does, and the glow bleeding past its own rounded corner is exactly the
 * bug that shipped here once already.
 */
function IllustrationSlot({
  height,
  width,
  radius = 18,
  ground,
  glowStrong,
  glowSoft,
  icon,
  imageSource,
  tagColor,
}: {
  height: number
  width?: number
  radius?: number
  ground: string
  glowStrong: string
  glowSoft: string
  icon: React.ReactNode
  imageSource?: ImageSourcePropType
  tagColor: string
}) {
  const gradientId = useId()
  return (
    <YStack
      height={height}
      width={width}
      overflow="hidden"
      backgroundColor={ground}
      style={{ borderRadius: radius, position: 'relative' }}
    >
      <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="45%" r="58%">
            <Stop offset="0" stopColor={glowStrong} stopOpacity={0.85} />
            <Stop offset="0.55" stopColor={glowSoft} stopOpacity={0.4} />
            <Stop offset="1" stopColor={ground} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      <YStack flex={1} alignItems="center" justifyContent="center">
        {imageSource ? (
          <Image source={imageSource} style={{ width: height * 0.72, height: height * 0.72 }} resizeMode="contain" />
        ) : (
          icon
        )}
      </YStack>
      {imageSource ? null : (
        <XStack position="absolute" bottom={6} right={8} backgroundColor="rgba(0,0,0,0.22)" borderRadius={999} paddingVertical="$0.5" paddingHorizontal="$2">
          <Text fontSize={9} fontWeight="700" color={tagColor}>
            3D · bientôt
          </Text>
        </XStack>
      )}
    </YStack>
  )
}

/**
 * A low, warm ember-colored glow in one corner of the hero card — the
 * "chaleureuse" pass: the flat near-black forest green read as corporate
 * rather than cozy, so this adds a lamplight-warm accent without moving
 * off the established dark-hero identity (`brandDeep` itself was also
 * warmed slightly — see soft-palette.ts).
 */
function HeroWarmGlow({ warm, ground }: { warm: string; ground: string }) {
  const gradientId = useId()
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      <Defs>
        <RadialGradient id={gradientId} cx="86%" cy="8%" r="55%">
          <Stop offset="0" stopColor={warm} stopOpacity={0.35} />
          <Stop offset="1" stopColor={ground} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
  )
}

/**
 * A big, saturated, tappable category tile — "Recettes" / "Courses" —
 * given the same visual weight as the hero so the home page reads as a
 * synthesis-plus-navigation hub, not an expiry log with two footnotes.
 */
function NavCard({
  bg,
  glow,
  onPress,
  icon,
  imageSource,
  title,
  subtitle,
  corner,
  palette,
}: {
  bg: string
  glow: string
  onPress: () => void
  icon: React.ReactNode
  imageSource?: ImageSourcePropType
  title: string
  subtitle: string
  corner: 'a' | 'b'
  palette: SoftPalette
}) {
  const radii =
    corner === 'a'
      ? { borderTopLeftRadius: 26, borderTopRightRadius: 14, borderBottomRightRadius: 26, borderBottomLeftRadius: 14 }
      : { borderTopLeftRadius: 14, borderTopRightRadius: 26, borderBottomRightRadius: 14, borderBottomLeftRadius: 26 }
  const hover = useHoverPress()

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[{ flex: 1 }, pointerCursor]}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <YStack
          backgroundColor={bg}
          padding="$2.5"
          gap="$3"
          style={{ ...radii, shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 4 }}
        >
          <IllustrationSlot
            height={72}
            ground={bg}
            glowStrong={glow}
            glowSoft={glow}
            icon={icon}
            imageSource={imageSource}
            tagColor="rgba(255,255,255,0.75)"
          />
          <YStack paddingHorizontal="$1.5" paddingBottom="$1.5">
            <Text fontSize={15} fontWeight="800" color={palette.onDark}>
              {title}
            </Text>
            <Text fontSize={12} fontWeight="600" color="rgba(255,255,255,0.85)" marginTop="$0.5" numberOfLines={1}>
              {subtitle}
            </Text>
          </YStack>
        </YStack>
      </Animated.View>
    </Pressable>
  )
}

/**
 * Two soft, off-center radial-gradient blobs feathering into the ground
 * color — the "blob blurred" background the direction asked for, built
 * with `react-native-svg`'s `RadialGradient` (native + web, no platform
 * `filter: blur()`) rather than a flat top-to-bottom rectangle. Strong
 * color sits high and off-axis; both blobs dissolve to fully transparent
 * well before the bottom of the block, so the page reads mint → white,
 * never mint → dark.
 */
export function BlobBackground({ blobStrong, blobSoft, ground }: { blobStrong: string; blobSoft: string; ground: string }) {
  // useId(), not hardcoded strings — see AuthBlobBackground's comment in
  // auth-ui.tsx for the collision this caused there (same component
  // mounted twice in one DOM under a Stack navigator).
  const id1 = useId()
  const id2 = useId()
  return (
    <Svg width="100%" height={520} style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' }}>
      <Defs>
        <RadialGradient id={id1} cx="28%" cy="-6%" r="62%">
          <Stop offset="0" stopColor={blobStrong} stopOpacity={0.9} />
          <Stop offset="0.5" stopColor={blobSoft} stopOpacity={0.55} />
          <Stop offset="1" stopColor={ground} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={id2} cx="88%" cy="14%" r="48%">
          <Stop offset="0" stopColor={blobSoft} stopOpacity={0.8} />
          <Stop offset="1" stopColor={ground} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={ground} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id2})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id1})`} />
    </Svg>
  )
}

export interface HouseholdDashboardProps {
  userName: string
  onSignOut: () => void
  signOutError: string | null
  onOpenRecettes: () => void
  onOpenCourses: () => void
}

const TABLET_BREAKPOINT = 768

export function HouseholdDashboard({
  userName,
  onSignOut,
  signOutError,
  onOpenRecettes,
  onOpenCourses,
}: HouseholdDashboardProps) {
  const palette = useSoftPalette()
  const { width } = useWindowDimensions()
  const isWide = width >= TABLET_BREAKPOINT
  const fixture = dashboardFixture
  const sortedProducts = useMemo(
    () => [...fixture.products].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
    [fixture.products],
  )
  const soonCount = fixture.products.filter((p) => p.status === 'soon').length
  const expiredCount = fixture.products.filter((p) => p.status === 'expired').length
  const watchCount = soonCount + expiredCount

  const reduceMotion = useReduceMotion()
  const [entrance] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (reduceMotion) {
      // Preserve the state change (content becomes visible/settled) without
      // the fade+rise motion — an instant cut, not a "0.01ms" fade that
      // would still technically animate.
      entrance.setValue(1)
      return
    }
    Animated.spring(entrance, {
      toValue: 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start()
  }, [entrance, reduceMotion])

  const [hint, setHint] = useState<string | null>(null)
  const [fabScale] = useState(() => new Animated.Value(1))
  function fabSpring(toValue: number, friction: number, tension: number) {
    if (reduceMotion) {
      Animated.timing(fabScale, { toValue, duration: 0, useNativeDriver: true }).start()
      return
    }
    Animated.spring(fabScale, { toValue, friction, tension, useNativeDriver: true }).start()
  }
  function pressFabIn() {
    fabSpring(0.86, 5, 200)
  }
  function pressFabOut() {
    fabSpring(1, 4, 160)
  }
  function hoverFabIn() {
    fabSpring(1.06, 6, 200)
  }
  function hoverFabOut() {
    fabSpring(1, 5, 160)
  }
  const signOutHover = useHoverPress()
  const seeAllHover = useHoverPress()

  function statusBg(status: ProductStatus) {
    return status === 'expired' ? palette.expiredBg : status === 'soon' ? palette.soonBg : palette.freshBg
  }
  function statusText(status: ProductStatus) {
    return status === 'expired' ? palette.expiredText : status === 'soon' ? palette.soonText : palette.freshText
  }

  const content = (
    // minHeight={0} on every nested flex:1 box below is load-bearing: CSS
    // flex items default to `min-height:auto`, which on web means a
    // flex:1 box still grows to fit its content instead of being clipped
    // at its allotted height — so ScrollView never gets a bounded parent
    // to scroll *within*, and the whole page grows past the viewport
    // instead. That's what "only the bottom shows" actually was.
    //
    // `position:'relative'` here is equally load-bearing and was the
    // actual sidebar bug: BlobBackground is `position:absolute,
    // left:0,right:0`, which on native Yoga is always confined to its
    // immediate parent — but on web, CSS absolute positioning escapes to
    // the nearest *positioned* ancestor, and with none declared it
    // escaped all the way to the viewport (1440px), painting the light
    // background clean over the sidebar. The sidebar was rendering
    // correctly underneath the whole time (confirmed via computed
    // styles) — just visually buried under this box's paint.
    <YStack flex={1} minHeight={0} backgroundColor={palette.gradientBottom} style={{ position: 'relative' }}>
      <BlobBackground blobStrong={palette.blobStrong} blobSoft={palette.blobSoft} ground={palette.gradientBottom} />
      <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={isWide ? [] : ['top', 'bottom']}>
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: isWide ? 40 : 140,
            paddingTop: isWide ? 32 : 20,
            maxWidth: isWide ? 640 : undefined,
            width: isWide ? '100%' : undefined,
            alignSelf: isWide ? 'center' : undefined,
          }}
        >
          <XStack justifyContent="space-between" alignItems="flex-start">
            <XStack alignItems="center" gap="$2.5">
              <Image
                source={carrotIllustration}
                style={{ width: 40, height: 40 }}
                resizeMode="contain"
                accessibilityLabel=""
              />
              <YStack>
                <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
                  Salut, {userName || 'toi'}
                </Text>
                <Text fontSize={20} fontWeight="800" color={palette.ink} marginTop="$1">
                  {fixture.householdName}
                </Text>
              </YStack>
            </XStack>
            <YStack alignItems="flex-end" gap="$2">
              {isWide ? null : (
                <XStack
                  alignItems="center"
                  gap="$1.5"
                  backgroundColor={palette.accentWarm}
                  paddingVertical="$1.5"
                  paddingHorizontal="$3"
                  borderRadius={999}
                  style={{ transform: [{ rotate: '-4deg' }] }}
                >
                  <FlameIcon size={14} color={palette.accentWarmText} />
                  <Text fontSize={12} fontWeight="800" color={palette.accentWarmText}>
                    {fixture.streakDays}j sans gaspi
                  </Text>
                </XStack>
              )}
              <Pressable
                onPress={onSignOut}
                onHoverIn={signOutHover.onHoverIn}
                onHoverOut={signOutHover.onHoverOut}
                onPressIn={signOutHover.onPressIn}
                onPressOut={signOutHover.onPressOut}
                testID="sign-out"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Se déconnecter"
                style={pointerCursor}
              >
                <Animated.View style={{ transform: [{ scale: signOutHover.scale }] }}>
                  <Text fontSize={11} fontWeight="500" color={palette.inkSecondary}>
                    Se déconnecter
                  </Text>
                </Animated.View>
              </Pressable>
            </YStack>
          </XStack>

          {signOutError ? (
            <Text fontSize={12} color={palette.expiredText} marginTop="$2">
              {signOutError}
            </Text>
          ) : null}

          <Animated.View
            style={{
              opacity: entrance,
              transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              marginTop: 20,
            }}
          >
            <YStack
              backgroundColor={palette.brandDeep}
              padding="$5"
              gap="$3"
              overflow="hidden"
              style={{
                borderTopLeftRadius: 36,
                borderTopRightRadius: 20,
                borderBottomRightRadius: 36,
                borderBottomLeftRadius: 20,
                position: 'relative',
                shadowColor: palette.shadowCool,
                shadowOffset: { width: 0, height: 16 },
                shadowOpacity: 0.22,
                shadowRadius: 28,
                elevation: 6,
              }}
            >
              <HeroWarmGlow warm={palette.accentWarm} ground={palette.brandDeep} />
              <Text fontSize={12} fontWeight="600" color={palette.brandDeepTextSecondary}>
                AUJOURD’HUI DANS TON FRIGO
              </Text>
              <Text fontSize={24} fontWeight="800" color={palette.brandDeepText} lineHeight={30}>
                {watchCount > 0 ? `${watchCount} produit${watchCount > 1 ? 's' : ''} à surveiller` : 'Tout est frais aujourd’hui'}
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                {soonCount > 0 ? (
                  <XStack alignItems="center" gap="$1.5" backgroundColor="rgba(0,0,0,0.28)" paddingVertical="$1.5" paddingHorizontal="$3" borderRadius={999}>
                    <TriangleAlertIcon size={13} color={palette.soonOnDark} />
                    <Text fontSize={12} fontWeight="700" color={palette.soonOnDark}>
                      {soonCount} bientôt
                    </Text>
                  </XStack>
                ) : null}
                {expiredCount > 0 ? (
                  <XStack alignItems="center" gap="$1.5" backgroundColor="rgba(0,0,0,0.28)" paddingVertical="$1.5" paddingHorizontal="$3" borderRadius={999}>
                    <CircleXIcon size={13} color={palette.expiredOnDark} />
                    <Text fontSize={12} fontWeight="700" color={palette.expiredOnDark}>
                      {expiredCount} périmé{expiredCount > 1 ? 's' : ''}
                    </Text>
                  </XStack>
                ) : null}
              </XStack>
            </YStack>
          </Animated.View>

          <XStack gap="$3" marginTop="$4">
            <StatCard
              bg={palette.cream}
              labelColor={palette.creamText}
              valueColor={palette.ink}
              chipColor={palette.chipOrange}
              icon={<PackageIcon size={18} color={palette.onDark} />}
              label="Produits"
              value={String(fixture.productCount)}
              corner="a"
              palette={palette}
            />
            <StatCard
              bg={palette.lavender}
              labelColor={palette.lavenderText}
              valueColor={palette.ink}
              chipColor={palette.chipViolet}
              icon={<TrendingUpIcon size={18} color={palette.onDark} />}
              label="Consommé"
              value={`${fixture.consumptionRatePct}%`}
              corner="b"
              palette={palette}
            />
            <StatCard
              bg={palette.mintPale}
              labelColor={palette.mintPaleText}
              valueColor={palette.ink}
              chipColor={palette.chipTeal}
              icon={<WalletIcon size={18} color={palette.onDark} />}
              label="Valeur"
              value={`${fixture.estimatedValueEur}€`}
              corner="c"
              palette={palette}
            />
          </XStack>

          <YStack marginTop="$6">
            <Text fontSize={15} fontWeight="800" color={palette.ink}>
              Accès rapide
            </Text>
            <XStack gap="$3" marginTop="$3">
              <NavCard
                bg={palette.navCardTeal}
                glow={palette.chipTeal}
                onPress={onOpenRecettes}
                icon={<ChefHatIcon size={30} color={palette.onDark} />}
                imageSource={potOfFoodIllustration}
                title="Recettes"
                subtitle={fixture.suggestedRecipe}
                corner="b"
                palette={palette}
              />
              <NavCard
                bg={palette.navCardViolet}
                glow={palette.chipViolet}
                onPress={onOpenCourses}
                icon={<ShoppingCartIcon size={30} color={palette.onDark} />}
                imageSource={shoppingCartIllustration}
                title="Courses"
                subtitle={`${fixture.shoppingListCount} articles`}
                corner="a"
                palette={palette}
              />
            </XStack>
          </YStack>

          <YStack marginTop="$6">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={15} fontWeight="800" color={palette.ink}>
                Périme bientôt
              </Text>
              <Pressable
                onPress={() => setHint('Voir tout le frigo — bientôt disponible')}
                onHoverIn={seeAllHover.onHoverIn}
                onHoverOut={seeAllHover.onHoverOut}
                onPressIn={seeAllHover.onPressIn}
                onPressOut={seeAllHover.onPressOut}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                accessibilityRole="button"
                accessibilityLabel="Voir tout le frigo"
                style={pointerCursor}
              >
                <Animated.View style={{ transform: [{ scale: seeAllHover.scale }] }}>
                  <Text fontSize={12} fontWeight="700" color={palette.inkSecondary}>
                    Voir tout →
                  </Text>
                </Animated.View>
              </Pressable>
            </XStack>
            <YStack
              marginTop="$3"
              backgroundColor={palette.gradientBottom}
              borderRadius={20}
              padding="$2"
              gap="$1"
              style={{ shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 1 }}
            >
              {sortedProducts.slice(0, 2).map((product) => (
                <XStack key={product.id} alignItems="center" gap="$3" padding="$2.5">
                  <Text fontSize={13} fontWeight="600" color={palette.ink} flex={1} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <YStack alignItems="flex-end" gap="$1">
                    <StatusChip status={product.status} bg={statusBg(product.status)} color={statusText(product.status)} />
                    <Text fontSize={10} fontWeight="500" color={palette.inkSecondary}>
                      {expiryLabel(product.daysUntilExpiry)}
                    </Text>
                  </YStack>
                </XStack>
              ))}
            </YStack>
          </YStack>
        </ScrollView>

        <YStack position="absolute" left={0} right={0} bottom={0} alignItems="center" paddingBottom={18}>
          {isWide ? null : (
          <XStack alignItems="center" gap="$3" width="92%" justifyContent="space-between">
            <BlurView
              intensity={40}
              tint="light"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderRadius: 999,
                overflow: 'hidden',
                gap: 8,
              }}
            >
              <YStack width={8} height={8} borderRadius={999} backgroundColor={palette.accentLime} />
              <Text fontSize={13} fontWeight="700" color={palette.ink}>
                Frigo
              </Text>
            </BlurView>

            <Pressable
              onPress={() => setHint('Scanner — bientôt disponible')}
              onHoverIn={hoverFabIn}
              onHoverOut={hoverFabOut}
              onPressIn={pressFabIn}
              onPressOut={pressFabOut}
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
                  transform: [{ scale: fabScale }],
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
          </XStack>
          )}
          {hint ? (
            <YStack marginTop="$2" backgroundColor={palette.brandDeep} borderRadius={999} paddingVertical="$1.5" paddingHorizontal="$4">
              <Text fontSize={12} fontWeight="600" color={palette.brandDeepText}>
                {hint}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      </SafeAreaView>
    </YStack>
  )

  if (!isWide) return content

  // Tablet/desktop: the whole layout — edge to edge, sidebar included —
  // is `layoutSurface`, a near-white warm-tinted gray, deliberately much
  // lighter than the old dark-brown surround (that read as "too much
  // brown" — this is a bare touch of it). The dashboard itself is a
  // separate pure-white rounded card *inset* into that surface with a
  // visible margin on every side (top/right/bottom, and the gap facing
  // the sidebar), like a mat around a print — content must stay the
  // lighter of the two for that to read at all, so the shadow between
  // them carries more of the separation now that the color step is small.
  // The sidebar has no card of its own: it's the same tone as the
  // layout, not a panel sitting on it.
  return (
    <SafeAreaView style={{ flex: 1, minHeight: 0, backgroundColor: palette.layoutSurface }} edges={['top', 'bottom']}>
      <XStack flex={1} minHeight={0} backgroundColor={palette.layoutSurface}>
        <Sidebar
          palette={palette}
          streakDays={fixture.streakDays}
          active="frigo"
          onOpenFrigo={() => {}}
          onOpenRecettes={onOpenRecettes}
          onOpenCourses={onOpenCourses}
          onScan={() => setHint('Scanner — bientôt disponible')}
        />
        <YStack flex={1} minHeight={0} padding="$4">
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
