/*
 * DIRECTION CONTRACT — dashboard foyer (redesign, 2026-08-27; pushed
 * toward Material Expressive same day per follow-up feedback; wired to
 * real household data 2026-09-05 after a usability critique)
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
 * three pastel stat cards (cream/lavender/pale-mint) each with its own
 * asymmetric corner set and a solid saturated icon chip (orange /
 * violet / teal) instead of a bare icon; full-pill badges, wide
 * low-opacity floating shadows, no visible borders; one geometric sans,
 * hierarchy by size+weight only; status still redundantly icon+color
 * (mint/amber/coral), kept from the previous world's accessibility raise.
 * STORY: a foyer member opens the app, reads the hero in one glance
 * ("3 produits à surveiller"), scans the three metrics, acts on the
 * products about to go bad, then jumps to Recettes/Courses.
 *
 * DATA (2026-09-05): every number on this screen comes from the backend —
 * `useProductsQuery`, `useShoppingItemsQuery`, `useHouseholdQuery`. The
 * screen previously rendered `dashboard.fixture.ts`, which meant the home
 * page contradicted the user's own actions (import 20 products, still
 * reads "12") and showed every foyer the same invented name. Two elements
 * died with the fixture rather than being re-sourced:
 *   — the "12j sans gaspi" streak badge: no "days without waste" concept
 *     exists anywhere in the domain, so there was nothing to compute it
 *     from. Removed here and from the desktop Sidebar.
 *   — the "Consommé %" and "Valeur €" stat cards: SaaS-dashboard reflexes
 *     with no kitchen decision behind them. Replaced by the three counts a
 *     foyer member actually acts on — what expires this week, what has
 *     already expired, what is left to buy.
 * ORDER: "Périme bientôt" now sits directly under the metrics, above
 * "Accès rapide" — it is the answer to the question the screen exists to
 * answer, and it used to be a two-row footnote at the bottom of the scroll.
 *
 * FIRST VIEWPORT: a small transparent carrot illustration beside the
 * greeting (no background chip — two earlier rounds tried it as a boxed
 * tile above and inside the hero; both read as a separate component
 * rather than personality attached to the person you're greeting) +
 * a Réglages icon button, spring-entrance warm hero card (ember glow
 * corner) with headline + two status pills, three asymmetric pastel stat
 * cards, the "Périme bientôt" preview (top 4, each row opening that
 * product), then "Accès rapide" — two big saturated NavCards
 * (Recettes / Courses) — closed by a floating glass pill (current
 * surface) and a lime FAB that scales down on press (the signature
 * interaction). Every Pressable spring-scales on hover (web) and press
 * (all platforms) via `useHoverPress`. At ≥768px width the phone's
 * floating pill+FAB are replaced by a persistent playful sidebar and the
 * whole dashboard becomes a rounded "insert" panel beside it — a two-pane
 * layout, not the phone layout stretched wide.
 * FORM: user-pinned direction, no concept-seed roll.
 *
 * DISCLOSED GAPS:
 * — 3D illustrations: the hero and both NavCards now carry real 3D
 *   renders (Microsoft Fluent Emoji 3D, MIT — carrot / pot-of-food /
 *   shopping-cart, see assets/illustrations/NOTICE.md) behind the glow,
 *   found by web search once image generation turned out unavailable
 *   this session. They're a found match, not the product's own
 *   commissioned set — swap for real product photography/illustration
 *   when that exists.
 */
import { useEffect, useMemo, useState } from 'react'
import { Animated, Image, type ImageSourcePropType, Pressable } from 'react-native'
import {
  ChefHatIcon,
  ChevronRightIcon,
  CircleXIcon,
  ReceiptIcon,
  ScanLineIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TriangleAlertIcon,
} from './dashboard-icons.js'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress, useReduceMotion } from '../shared/hover.js'
import { AppShell } from '../shared/app-shell.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { StatusChip } from './status-chip.js'
import { StatCard } from './stat-card.js'
import { HeroWarmGlow } from './hero-warm-glow.js'
import { NavCard } from './nav-card.js'
import { useSoftPalette } from './soft-palette.js'
import type { SoftPalette } from './soft-palette.js'
import { daysUntilExpiry, expiryLabel, sortByExpiry, statusOf, type ProductStatus } from './product-status.js'
import { useProductsQuery } from '../../application/fridge/products.query.js'
import { useShoppingItemsQuery } from '../../application/shopping-list/shopping-items.query.js'
import { useHouseholdQuery } from '../../application/identity/household.query.js'
import type { Product } from '../../domain/fridge/product.js'

// Real 3D illustrations — Microsoft Fluent Emoji 3D (MIT license), bundled
// locally rather than fetched from a CDN at runtime (this app makes no
// direct client→external-service calls by design — see PRODUCT.md).
// Attribution: assets/illustrations/NOTICE.md.
const carrotIllustration = require('../../../assets/illustrations/carrot-3d.png') as ImageSourcePropType
const potOfFoodIllustration = require('../../../assets/illustrations/pot-of-food-3d.png') as ImageSourcePropType
const shoppingCartIllustration = require('../../../assets/illustrations/shopping-cart-3d.png') as ImageSourcePropType

/** Rows shown in the "Périme bientôt" preview before "Voir tout" takes over. */
const PREVIEW_COUNT = 4

export interface HouseholdDashboardProps {
  userName: string
  onOpenRecettes: () => void
  onOpenCourses: () => void
  onOpenFridge: () => void
  onOpenProduct: (productId: string) => void
  onAddProduct: () => void
  onScanProduct: () => void
  onScanReceipt: () => void
  onOpenSettings: () => void
}

export function HouseholdDashboard({
  userName,
  onOpenRecettes,
  onOpenCourses,
  onOpenFridge,
  onOpenProduct,
  onAddProduct,
  onScanProduct,
  onScanReceipt,
  onOpenSettings,
}: HouseholdDashboardProps) {
  const palette = useSoftPalette()
  const productsQuery = useProductsQuery()
  const shoppingQuery = useShoppingItemsQuery()
  const householdQuery = useHouseholdQuery()

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data])
  const dated = useMemo(
    () => products.map((product) => ({ product, daysLeft: daysUntilExpiry(product) })),
    [products],
  )
  const soonProducts = useMemo(
    () => sortByExpiry(products).filter((product) => statusOf(daysUntilExpiry(product)) !== 'fresh'),
    [products],
  )
  const previewProducts = useMemo(
    // Once nothing is at risk, the preview still earns its place by showing
    // what to use up next rather than collapsing to an empty box.
    () => (soonProducts.length > 0 ? soonProducts : sortByExpiry(products)).slice(0, PREVIEW_COUNT),
    [soonProducts, products],
  )

  const expiredCount = dated.filter(({ daysLeft }) => statusOf(daysLeft) === 'expired').length
  const soonCount = dated.filter(({ daysLeft }) => statusOf(daysLeft) === 'soon').length
  const thisWeekCount = dated.filter(({ daysLeft }) => daysLeft !== null && daysLeft > 0 && daysLeft <= 7).length
  const toBuyCount = (shoppingQuery.data ?? []).filter((item) => !item.checked).length
  const watchCount = soonCount + expiredCount

  const loading = productsQuery.isPending
  const failed = !productsQuery.isPending && productsQuery.isError
  const empty = !loading && !failed && products.length === 0
  const householdName = householdQuery.data?.name ?? 'Ton foyer'

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

  const seeAllHover = useHoverPress()
  const settingsHover = useHoverPress()

  const [scanSheetOpen, setScanSheetOpen] = useState(false)

  function openScanSheet() {
    setScanSheetOpen(true)
  }
  function closeScanSheet() {
    setScanSheetOpen(false)
  }
  function handleScanProductChoice() {
    closeScanSheet()
    onScanProduct()
  }
  function handleScanReceiptChoice() {
    closeScanSheet()
    onScanReceipt()
  }

  function statusBg(status: ProductStatus) {
    return status === 'expired' ? palette.expiredBg : status === 'soon' ? palette.soonBg : palette.freshBg
  }
  function statusText(status: ProductStatus) {
    return status === 'expired' ? palette.expiredText : status === 'soon' ? palette.soonText : palette.freshText
  }

  function heroHeadline() {
    if (loading) return 'On regarde dans ton frigo…'
    if (failed) return 'Frigo indisponible'
    if (empty) return 'Ton frigo est encore vide'
    return watchCount > 0
      ? `${watchCount} produit${watchCount > 1 ? 's' : ''} à surveiller`
      : 'Tout est frais aujourd’hui'
  }

  /** `—` rather than `0` while loading: an honest blank, not a wrong number. */
  function metric(value: number) {
    return loading || failed ? '—' : String(value)
  }

  return (
    <>
    <AppShell nav={{ kind: 'tab', tab: 'accueil', onScan: openScanSheet }}>
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$2.5" flex={1}>
              <Image
                source={carrotIllustration}
                style={{ width: 40, height: 40 }}
                resizeMode="contain"
                accessibilityLabel=""
              />
              <YStack flex={1}>
                <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
                  Salut, {userName || 'toi'}
                </Text>
                <Text fontSize={20} fontWeight="800" color={palette.ink} marginTop="$1" numberOfLines={1}>
                  {householdName}
                </Text>
              </YStack>
            </XStack>
            {/* Was an 11px grey text link — the app's only route to Réglages,
                and invisible next to a 40px illustration. Now a real 44pt
                icon button (the Sidebar carries its own entry on desktop). */}
            <Pressable
              onPress={onOpenSettings}
              testID="open-settings"
              onHoverIn={settingsHover.onHoverIn}
              onHoverOut={settingsHover.onHoverOut}
              onPressIn={settingsHover.onPressIn}
              onPressOut={settingsHover.onPressOut}
              accessibilityRole="button"
              accessibilityLabel="Réglages"
              style={pointerCursor}
            >
              <Animated.View style={{ transform: [{ scale: settingsHover.scale }] }}>
                <YStack
                  width={44}
                  height={44}
                  borderRadius={999}
                  backgroundColor={palette.cream}
                  alignItems="center"
                  justifyContent="center"
                >
                  <SettingsIcon size={19} color={palette.ink} />
                </YStack>
              </Animated.View>
            </Pressable>
          </XStack>

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
                {heroHeadline()}
              </Text>
              {failed ? (
                <Text fontSize={13} fontWeight="500" color={palette.brandDeepTextSecondary}>
                  On n’a pas pu joindre le serveur.
                </Text>
              ) : null}
              {empty ? (
                <Text fontSize={13} fontWeight="500" color={palette.brandDeepTextSecondary}>
                  Ajoute un produit ou scanne un ticket de caisse pour démarrer.
                </Text>
              ) : null}
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
                {failed ? (
                  <Pressable
                    testID="dashboard-retry"
                    onPress={() => productsQuery.refetch()}
                    accessibilityRole="button"
                    accessibilityLabel="Réessayer de charger le frigo"
                    style={pointerCursor}
                  >
                    <XStack alignItems="center" backgroundColor={palette.accentLime} paddingVertical="$2" paddingHorizontal="$4" borderRadius={999} minHeight={44}>
                      <Text fontSize={13} fontWeight="800" color={palette.accentLimeText}>
                        Réessayer
                      </Text>
                    </XStack>
                  </Pressable>
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
              icon={<TriangleAlertIcon size={18} color={palette.onDark} />}
              label="Cette semaine"
              value={metric(thisWeekCount)}
              corner="a"
              palette={palette}
            />
            <StatCard
              bg={palette.lavender}
              labelColor={palette.lavenderText}
              valueColor={palette.ink}
              chipColor={palette.chipViolet}
              icon={<CircleXIcon size={18} color={palette.onDark} />}
              label="Périmés"
              value={metric(expiredCount)}
              corner="b"
              palette={palette}
            />
            <StatCard
              bg={palette.mintPale}
              labelColor={palette.mintPaleText}
              valueColor={palette.ink}
              chipColor={palette.chipTeal}
              icon={<ShoppingCartIcon size={18} color={palette.onDark} />}
              label="À racheter"
              value={shoppingQuery.isPending ? '—' : String(toBuyCount)}
              corner="c"
              palette={palette}
            />
          </XStack>

          <YStack marginTop="$6">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={15} fontWeight="800" color={palette.ink}>
                {soonProducts.length > 0 ? 'Périme bientôt' : 'À consommer en premier'}
              </Text>
              <Pressable
                onPress={onOpenFridge}
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
              {loading ? (
                <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} padding="$3">
                  Chargement…
                </Text>
              ) : null}
              {failed ? (
                <Text fontSize={13} fontWeight="500" color={palette.expiredText} padding="$3">
                  Liste indisponible hors connexion.
                </Text>
              ) : null}
              {empty ? (
                <YStack padding="$3" gap="$3">
                  <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
                    Rien dans le frigo pour l’instant.
                  </Text>
                  <XStack gap="$2" flexWrap="wrap">
                    <EmptyAction label="Ajouter un produit" onPress={onAddProduct} testID="dashboard-empty-add" primary palette={palette} />
                    <EmptyAction label="Scanner un ticket" onPress={onScanReceipt} testID="dashboard-empty-scan" palette={palette} />
                  </XStack>
                </YStack>
              ) : null}
              {previewProducts.map((product) => (
                <PreviewRow
                  key={product.id}
                  product={product}
                  onPress={() => onOpenProduct(product.id)}
                  statusBg={statusBg}
                  statusText={statusText}
                  palette={palette}
                />
              ))}
            </YStack>
          </YStack>

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
                subtitle={soonCount + expiredCount > 0 ? 'Cuisine ce qui périme' : 'Idées pour ce soir'}
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
                subtitle={
                  shoppingQuery.isPending
                    ? 'Chargement…'
                    : toBuyCount === 0
                      ? 'Liste à jour'
                      : `${toBuyCount} article${toBuyCount > 1 ? 's' : ''} à prendre`
                }
                corner="a"
                palette={palette}
              />
            </XStack>
          </YStack>
    </AppShell>
    {/* The mobile bottom nav (glass pill + FAB) and the desktop sidebar are
        both AppShell's job now — see app-shell.tsx. Keeping them here,
        duplicated per screen, is exactly what left the FAB and persistent
        nav working on this screen only. */}
    <ActionSheet
      visible={scanSheetOpen}
      onClose={closeScanSheet}
      options={[
        {
          testID: 'scan-sheet-product',
          label: 'Scanner un produit',
          icon: (color) => <ScanLineIcon size={18} color={color} />,
          tint: palette.chipTeal,
          onPress: handleScanProductChoice,
        },
        {
          testID: 'scan-sheet-receipt',
          label: 'Scanner un ticket de caisse',
          icon: (color) => <ReceiptIcon size={18} color={color} />,
          tint: palette.chipViolet,
          onPress: handleScanReceiptChoice,
        },
      ]}
    />
    </>
  )
}

/**
 * The preview rows used to be inert text. They are the one place on the home
 * screen that names a specific product, so they are also the shortest route
 * to acting on it — each row opens that product.
 */
function PreviewRow({
  product,
  onPress,
  statusBg,
  statusText,
  palette,
}: {
  product: Product
  onPress: () => void
  statusBg: (status: ProductStatus) => string
  statusText: (status: ProductStatus) => string
  palette: SoftPalette
}) {
  const hover = useHoverPress()
  const daysLeft = daysUntilExpiry(product)
  const status = statusOf(daysLeft)
  return (
    <Pressable
      testID={`dashboard-product-${product.id}`}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${product.name} — ${expiryLabel(daysLeft)}`}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack alignItems="center" gap="$3" padding="$2.5" minHeight={44}>
          <Text fontSize={13} fontWeight="600" color={palette.ink} flex={1} numberOfLines={1}>
            {product.name}
          </Text>
          <YStack alignItems="flex-end" gap="$1">
            <StatusChip status={status} bg={statusBg(status)} color={statusText(status)} />
            <Text fontSize={10} fontWeight="500" color={palette.inkSecondary}>
              {expiryLabel(daysLeft)}
            </Text>
          </YStack>
          <ChevronRightIcon size={16} color={palette.inkSecondary} />
        </XStack>
      </Animated.View>
    </Pressable>
  )
}

/** An empty state that hands over the next action instead of describing the void. */
function EmptyAction({
  label,
  onPress,
  testID,
  primary,
  palette,
}: {
  label: string
  onPress: () => void
  testID: string
  primary?: boolean
  palette: SoftPalette
}) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack
          alignItems="center"
          justifyContent="center"
          minHeight={44}
          paddingHorizontal="$4"
          borderRadius={999}
          backgroundColor={primary ? palette.accentLime : palette.cream}
        >
          <Text fontSize={13} fontWeight="800" color={primary ? palette.accentLimeText : palette.ink}>
            {label}
          </Text>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
