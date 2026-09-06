/*
 * DIRECTION CONTRACT — recipe list screen (2026-08-28; wired to the real
 * generate/detail endpoints 2026-09-05)
 *
 * Same world, same shell pattern as shopping-list-screen.tsx: mint blob
 * ground on mobile, shared `Sidebar` (active="recettes") on tablet/
 * desktop — both now via the shared `AppShell` (see app-shell.tsx; an
 * audit found this shell copy-pasted per screen instead of extracted).
 * Recipe cards use the pastel-card + asymmetric-corner language already
 * established for StatCard/NavCard, not a new card shape.
 *
 * The screen used to be list-and-toast: every card tap surfaced "bientôt
 * disponible" and there was no way to generate anything, which left the
 * product's headline job unreachable. Cards now open
 * `(tabs)/recipes/[id]`, and "Générer une recette" calls
 * `POST /api/recipes/generate` with a real pending state — an AI call is
 * seconds long, so the button says so rather than going quiet.
 *
 * Generation moved into a modal composer (2026-09-05,
 * `recipe-generate-screen.tsx`): the endpoint's free-text `prompt` had
 * never been reachable from the UI, so the app could cook from the
 * garde-manger but not from an intention. The lime card here is now the
 * opener for that sheet — everything on the sheet is optional, so the
 * one-tap generation is still one tap plus a confirm, and the seconds-long
 * request gets a real loader where it is issued instead of a silent button.
 */
import { Animated, FlatList, Pressable } from 'react-native'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell, shellContentStyle, useAppShellLayout } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { pullToRefreshControl, usePullToRefresh } from '../shared/pull-to-refresh.js'
import { useScanSheet } from '../shared/scan-sheet.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ChefHatIcon, ChevronRightIcon } from '../dashboard/dashboard-icons.js'
import { sortByExpiry } from '../dashboard/product-status.js'
import { SkeletonCard, SkeletonGroup } from '../shared/skeleton.js'
import { RecipeCard } from './recipe-card.js'
import { useRecipesQuery } from '../../application/recipe/recipes.query.js'
import { useProductsQuery } from '../../application/fridge/products.query.js'
import type { Recipe } from '../../domain/recipe/recipe.js'

/** How many product names the opener's caption is allowed to promise. */
const COOKING_FROM_COUNT = 2

export function RecipeListScreen() {
  const palette = useSoftPalette()
  const { openScanSheet, scanSheet } = useScanSheet()
  const recipesQuery = useRecipesQuery()
  const productsQuery = useProductsQuery()
  const recipes = recipesQuery.data ?? []
  // Both queries, not just the recipes one: the opener's caption names real
  // products, so refreshing half of what the screen shows would let the two
  // halves disagree.
  const refresh = usePullToRefresh(
    () => recipesQuery.refetch(),
    () => productsQuery.refetch(),
  )
  const cookingFrom = sortByExpiry(productsQuery.data ?? [])
    .slice(0, COOKING_FROM_COUNT)
    .map((product) => product.name)

  const nav = { kind: 'tab' as const, tab: 'recettes' as const, onScan: openScanSheet }
  const { isWide, hasMobileNav } = useAppShellLayout(nav)

  function handleOpenRecipe(recipe: Recipe) {
    router.push({ pathname: '/(tabs)/recipes/[id]', params: { id: recipe.id } })
  }

  return (
    <>
    <AppShell nav={nav} scrollable={false}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <ChefHatIcon size={19} color={color} />}
          title="Recettes"
          subtitle={recipesQuery.isPending ? undefined : `${recipes.length} recette${recipes.length > 1 ? 's' : ''}`}
        />
      }
    >
      <FlatList
        data={recipesQuery.isPending ? [] : recipes}
        keyExtractor={(recipe) => recipe.id}
        renderItem={({ item, index }) => (
          <YStack marginBottom="$3">
            <RecipeCard recipe={item} corner={index % 2 === 0 ? 'a' : 'b'} onPress={() => handleOpenRecipe(item)} />
          </YStack>
        )}
        contentContainerStyle={{ ...shellContentStyle({ isWide, hasMobileNav }), paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
        refreshControl={pullToRefreshControl(refresh, palette)}
        ListHeaderComponent={
          <YStack marginBottom="$5">
          <GenerateOpener
            palette={palette}
            cookingFrom={cookingFrom}
            onPress={() => router.push('/(tabs)/recipes/generate')}
          />

          {recipesQuery.isError ? (
            <XStack alignItems="center" gap="$3" backgroundColor={palette.expiredBg} borderRadius={14} padding="$3" marginTop="$4">
              <Text fontSize={13} fontWeight="600" color={palette.expiredText} flex={1}>
                Impossible de charger les recettes.
              </Text>
              <Pressable
                testID="recipes-retry"
                onPress={() => recipesQuery.refetch()}
                accessibilityRole="button"
                accessibilityLabel="Réessayer"
                style={pointerCursor}
              >
                <XStack alignItems="center" minHeight={44} paddingHorizontal="$3">
                  <Text fontSize={13} fontWeight="800" color={palette.expiredText}>
                    Réessayer
                  </Text>
                </XStack>
              </Pressable>
            </XStack>
          ) : null}

          {!recipesQuery.isPending && !recipesQuery.isError && recipes.length === 0 ? (
            <YStack alignItems="center" gap="$3" marginTop="$8" paddingHorizontal="$4">
              <ChefHatIcon size={32} color={palette.inkSecondary} />
              <Text fontSize={14} fontWeight="700" color={palette.ink}>
                Aucune recette pour l’instant
              </Text>
              <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">
                Génère-en une à partir de ce qu’il faut finir en premier.
              </Text>
              {/* The action inside the empty state, not only in the card the user
                  has already scrolled past. */}
              <Pressable
                testID="recipes-empty-generate"
                onPress={() => router.push('/(tabs)/recipes/generate')}
                accessibilityRole="button"
                accessibilityLabel="Générer une recette"
                style={pointerCursor}
              >
                <XStack backgroundColor={palette.accentLime} paddingVertical="$2.5" paddingHorizontal="$4" borderRadius={999} minHeight={44} alignItems="center">
                  <Text fontSize={13} fontWeight="800" color={palette.accentLimeText}>
                    Générer une recette
                  </Text>
                </XStack>
              </Pressable>
            </YStack>
          ) : null}

          </YStack>
        }
        ListEmptyComponent={
          recipesQuery.isPending ? (
            <SkeletonGroup label="Chargement des recettes">
              <SkeletonCard height={110} />
              <SkeletonCard height={110} />
              <SkeletonCard height={110} />
            </SkeletonGroup>
          ) : null
        }
      />
    </AppShell>
    {scanSheet}
    </>
  )
}

/**
 * Deliberately a full-width card rather than a chip: generating is the
 * screen's reason to exist, and the caption carries the one thing a cook
 * needs to trust it — what it will cook from, by name. The chevron says it
 * opens something; the sheet behind it asks for nothing mandatory.
 */
function GenerateOpener({
  palette,
  cookingFrom,
  onPress,
}: {
  palette: SoftPalette
  cookingFrom: readonly string[]
  onPress: () => void
}) {
  const hover = useHoverPress()
  const caption = cookingFrom.length > 0 ? `À partir de : ${listNames(cookingFrom)}` : 'À partir de ce qu’il faut finir en premier.'

  return (
    <Pressable
      testID="recipes-generate"
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Générer une recette"
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }], marginTop: 20 }}>
        <XStack
          alignItems="center"
          gap="$3"
          backgroundColor={palette.accentLime}
          padding="$4"
          minHeight={50}
          style={{
            borderTopLeftRadius: 24,
            borderTopRightRadius: 14,
            borderBottomRightRadius: 24,
            borderBottomLeftRadius: 14,
          }}
        >
          <ChefHatIcon size={20} color={palette.accentLimeText} />
          <YStack flex={1} minWidth={0}>
            <Text fontSize={14} fontWeight="800" color={palette.accentLimeText}>
              Générer une recette
            </Text>
            <Text fontSize={12} fontWeight="500" color={palette.accentLimeText} opacity={0.8} numberOfLines={1}>
              {caption}
            </Text>
          </YStack>
          <ChevronRightIcon size={18} color={palette.accentLimeText} />
        </XStack>
      </Animated.View>
    </Pressable>
  )
}

/** "yaourt et épinards" — a list a person reads, not a truncated array. */
function listNames(names: readonly string[]): string {
  return names.join(' et ')
}
