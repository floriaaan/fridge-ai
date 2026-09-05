import { useMemo, useState } from 'react'
import { FlatList, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { AppShell, shellContentStyle, useAppShellLayout } from '../shared/app-shell.js'
import { useScanSheet } from '../shared/scan-sheet.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { daysUntilExpiry, expiryLabel, sortByExpiry, statusOf } from '../dashboard/product-status.js'
import { FormField } from './form-field.js'
import { useProductsQuery } from '../../application/fridge/products.query.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { Product } from '../../domain/fridge/product.js'

const FILTER_LABELS: Record<LocationValue, string> = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' }

// Exported for direct unit testing of the badge thresholds — see fridge-list-screen.test.tsx.
// Both read the app-wide definition in product-status.ts: this screen used to
// carry its own fractional-day copy, so a product expiring today was "Bientôt
// périmé" here and "Expiré" on the dashboard.
export function isExpired(product: Product): boolean {
  return statusOf(daysUntilExpiry(product)) === 'expired'
}

export function isExpiringSoon(product: Product, withinDays = 3): boolean {
  const days = daysUntilExpiry(product)
  return days !== null && days >= 0 && days <= withinDays
}

function FilterChip({
  label,
  active,
  onPress,
  palette,
  testID,
}: {
  label: string
  active: boolean
  onPress: () => void
  palette: SoftPalette
  testID: string
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
      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={pointerCursor}
    >
      {/* minHeight 44: an audit-caught touch-target floor, not a style nit — see sidebar.tsx's SidebarItem. */}
      <XStack
        backgroundColor={active ? palette.accentLime : palette.mintPale}
        borderRadius={999}
        paddingVertical="$2.5"
        paddingHorizontal="$3"
        minHeight={44}
        alignItems="center"
      >
        <Text fontSize={12} fontWeight="700" color={active ? palette.accentLimeText : palette.mintPaleText}>
          {label}
        </Text>
      </XStack>
    </Pressable>
  )
}

function ProductRow({ product, palette }: { product: Product; palette: SoftPalette }) {
  const hover = useHoverPress()
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(tabs)/fridge/[id]', params: { id: product.id } })}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={pointerCursor}
    >
      <XStack
        backgroundColor={palette.gradientBottom}
        borderRadius={16}
        padding="$3"
        marginBottom="$2"
        alignItems="center"
        gap="$3"
      >
        <YStack flex={1}>
          <Text fontSize={14} fontWeight="700" color={palette.ink}>
            {product.name}
          </Text>
          <Text fontSize={12} color={palette.inkSecondary}>
            {product.quantity.amount} {product.quantity.unit} · {FILTER_LABELS[product.location]} · {expiryLabel(daysUntilExpiry(product))}
          </Text>
        </YStack>
        {isExpired(product) ? (
          <XStack backgroundColor={palette.expiredBg} borderRadius={999} paddingVertical="$1" paddingHorizontal="$2.5">
            <Text fontSize={11} fontWeight="700" color={palette.expiredText}>
              Périmé
            </Text>
          </XStack>
        ) : isExpiringSoon(product) ? (
          <XStack backgroundColor={palette.soonBg} borderRadius={999} paddingVertical="$1" paddingHorizontal="$2.5">
            <Text fontSize={11} fontWeight="700" color={palette.soonText}>
              Bientôt périmé
            </Text>
          </XStack>
        ) : null}
      </XStack>
    </Pressable>
  )
}

function FridgeListHeader({
  palette,
  locationFilter,
  onFilterChange,
  search,
  onSearchChange,
  count,
}: {
  palette: SoftPalette
  locationFilter: LocationValue | null
  onFilterChange: (filter: LocationValue | null) => void
  search: string
  onSearchChange: (value: string) => void
  count: number
}) {
  return (
    <YStack>
      <XStack justifyContent="space-between" alignItems="center">
        <YStack>
          <Text fontSize={20} fontWeight="800" color={palette.ink}>
            Frigo
          </Text>
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} marginTop="$0.5">
            {count} produit{count > 1 ? 's' : ''} · le plus urgent en premier
          </Text>
        </YStack>
        <Pressable
          testID="fridge-add"
          onPress={() => router.push('/(tabs)/fridge/new')}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un produit"
          style={pointerCursor}
        >
          <XStack
            backgroundColor={palette.accentLime}
            borderRadius={999}
            paddingVertical="$2.5"
            paddingHorizontal="$3"
            minHeight={44}
            alignItems="center"
          >
            <Text fontSize={13} fontWeight="800" color={palette.accentLimeText}>
              + Ajouter
            </Text>
          </XStack>
        </Pressable>
      </XStack>

      <YStack marginTop="$3">
        <FormField
          testID="fridge-search"
          label="Rechercher"
          value={search}
          onChangeText={onSearchChange}
          palette={palette}
          placeholder="Un nom de produit"
          autoCapitalize="none"
        />
      </YStack>

      {/* Horizontally scrollable: four fixed chips overflowed below ~340pt,
          and "Congélateur" fell off the row. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
      >
        <FilterChip
          testID="fridge-filter-all"
          label="Tout"
          active={locationFilter === null}
          onPress={() => onFilterChange(null)}
          palette={palette}
        />
        {LOCATIONS.map((location) => (
          <FilterChip
            key={location}
            testID={`fridge-filter-${location}`}
            label={FILTER_LABELS[location]}
            active={locationFilter === location}
            onPress={() => onFilterChange(location)}
            palette={palette}
          />
        ))}
      </ScrollView>
    </YStack>
  )
}

export function FridgeListScreen() {
  const palette = useSoftPalette()
  const [locationFilter, setLocationFilter] = useState<LocationValue | null>(null)
  const [search, setSearch] = useState('')
  const products = useProductsQuery(locationFilter ? { location: locationFilter } : undefined)
  const { openScanSheet, scanSheet } = useScanSheet()
  const nav = { kind: 'tab' as const, tab: 'frigo' as const, onScan: openScanSheet }
  const { isWide, hasMobileNav } = useAppShellLayout(nav)

  // Soonest-expiry first, and searchable: answering "what goes bad next" in a
  // 40-item fridge used to mean scanning the whole list for colored pills.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = needle.length > 0
      ? (products.data ?? []).filter((product) => product.name.toLowerCase().includes(needle))
      : (products.data ?? [])
    return sortByExpiry(filtered)
  }, [products.data, search])

  return (
    <>
    <AppShell nav={nav} scrollable={false}>
      {/* Virtualized (FlatList), not ScrollView+.map — an audit flagged the
          household product list as an unbounded-growth performance risk
          otherwise; AppShell's `scrollable={false}` hands this screen the
          scroll container so virtualization actually applies. */}
      <FlatList
        data={visible}
        keyExtractor={(product) => product.id}
        renderItem={({ item }) => <ProductRow product={item} palette={palette} />}
        contentContainerStyle={shellContentStyle({ isWide, hasMobileNav })}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <YStack marginBottom="$4">
            <FridgeListHeader
              palette={palette}
              locationFilter={locationFilter}
              onFilterChange={setLocationFilter}
              search={search}
              onSearchChange={setSearch}
              count={visible.length}
            />
          </YStack>
        }
        ListEmptyComponent={
          products.isPending ? (
            <Text fontSize={13} color={palette.inkSecondary} marginTop="$4">
              Chargement…
            </Text>
          ) : visible.length === 0 ? (
            <EmptyFridge search={search} palette={palette} />
          ) : null
        }
      />
    </AppShell>
    {scanSheet}
    </>
  )
}

function EmptyFridge({ search, palette }: { search: string; palette: SoftPalette }) {
  if (search.trim().length > 0) {
    return (
      <Text fontSize={13} color={palette.inkSecondary} marginTop="$4">
        Aucun produit ne correspond à « {search.trim()} ».
      </Text>
    )
  }
  return (
    <YStack gap="$3" marginTop="$6" alignItems="center">
      <Text fontSize={15} fontWeight="700" color={palette.ink}>
        Rien ici pour l&apos;instant
      </Text>
      <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">
        Scanne un code-barres ou un ticket de caisse pour remplir le frigo sans rien taper.
      </Text>
      <Pressable
        testID="fridge-empty-add"
        onPress={() => router.push('/(tabs)/fridge/new')}
        accessibilityRole="button"
        accessibilityLabel="Ajouter un produit"
        style={pointerCursor}
      >
        <XStack alignItems="center" minHeight={44} paddingHorizontal="$5" borderRadius={999} backgroundColor={palette.accentLime}>
          <Text fontSize={14} fontWeight="800" color={palette.accentLimeText}>
            Ajouter un produit
          </Text>
        </XStack>
      </Pressable>
    </YStack>
  )
}
