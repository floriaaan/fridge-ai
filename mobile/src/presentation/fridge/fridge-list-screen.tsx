import { useState } from 'react'
import { Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { Sidebar } from '../shared/sidebar.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { useProductsQuery } from '../../application/fridge/products.query.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { Product } from '../../domain/fridge/product.js'

const TABLET_BREAKPOINT = 768
const FILTER_LABELS: Record<LocationValue, string> = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' }

function isExpiringSoon(product: Product, withinDays = 3): boolean {
  if (!product.expiresAt) return false
  const days = (new Date(product.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  return days >= 0 && days <= withinDays
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={pointerCursor}
    >
      <XStack
        backgroundColor={active ? palette.accentLime : palette.mintPale}
        borderRadius={999}
        paddingVertical="$1.5"
        paddingHorizontal="$3"
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
            {product.quantity.amount} {product.quantity.unit} · {FILTER_LABELS[product.location]}
          </Text>
        </YStack>
        {isExpiringSoon(product) ? (
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

export function FridgeListScreen() {
  const palette = useSoftPalette()
  const { width } = useWindowDimensions()
  const isWide = width >= TABLET_BREAKPOINT
  const [locationFilter, setLocationFilter] = useState<LocationValue | null>(null)
  const products = useProductsQuery(locationFilter ? { location: locationFilter } : undefined)

  const content = (
    <YStack flex={1} padding="$4">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={20} fontWeight="800" color={palette.ink}>
          Frigo
        </Text>
        <Pressable
          testID="fridge-add"
          onPress={() => router.push('/(tabs)/fridge/new')}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un produit"
          style={pointerCursor}
        >
          <XStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$1.5" paddingHorizontal="$3">
            <Text fontSize={13} fontWeight="800" color={palette.accentLimeText}>
              + Ajouter
            </Text>
          </XStack>
        </Pressable>
      </XStack>

      <XStack gap="$2" marginTop="$3">
        <FilterChip
          testID="fridge-filter-all"
          label="Tout"
          active={locationFilter === null}
          onPress={() => setLocationFilter(null)}
          palette={palette}
        />
        {LOCATIONS.map((location) => (
          <FilterChip
            key={location}
            testID={`fridge-filter-${location}`}
            label={FILTER_LABELS[location]}
            active={locationFilter === location}
            onPress={() => setLocationFilter(location)}
            palette={palette}
          />
        ))}
      </XStack>

      <ScrollView style={{ marginTop: 16 }} showsVerticalScrollIndicator={false}>
        {products.data?.length === 0 ? (
          <Text fontSize={13} color={palette.inkSecondary} marginTop="$4">
            Aucun produit ici pour l'instant.
          </Text>
        ) : null}
        {products.data?.map((product) => (
          <ProductRow key={product.id} product={product} palette={palette} />
        ))}
      </ScrollView>
    </YStack>
  )

  if (isWide) {
    return (
      <YStack flex={1} backgroundColor={palette.layoutSurface}>
        <SafeAreaView style={{ flex: 1 }}>
          <XStack flex={1}>
            <Sidebar
              palette={palette}
              streakDays={0}
              active="frigo"
              onOpenFrigo={() => {}}
              onOpenRecettes={() => router.push('/(tabs)/recipes')}
              onOpenCourses={() => router.push('/(tabs)/shopping-list')}
              onScan={() => router.push({ pathname: '/(tabs)/fridge/scan', params: { mode: 'create' } })}
            />
            <YStack flex={1} backgroundColor={palette.gradientBottom}>
              {content}
            </YStack>
          </XStack>
        </SafeAreaView>
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor={palette.gradientBottom}>
      <SafeAreaView style={{ flex: 1 }}>{content}</SafeAreaView>
    </YStack>
  )
}
