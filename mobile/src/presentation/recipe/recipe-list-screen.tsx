/*
 * DIRECTION CONTRACT — recipe list screen (2026-08-28)
 *
 * Same world, same shell pattern as shopping-list-screen.tsx: mint blob
 * ground on mobile, shared `Sidebar` (active="recettes") on tablet/
 * desktop. Recipe cards use the pastel-card + asymmetric-corner language
 * already established for StatCard/NavCard, not a new card shape.
 *
 * SCOPE, disclosed: list + read only. Tapping a card, AI generation
 * (`POST /api/recipes/generate`), and suggestions-from-expiring-products
 * are real backend endpoints not wired here yet — a tap on a recipe
 * surfaces the same "bientôt disponible" hint as everywhere else in the
 * app rather than a dead control.
 */
import { useState } from 'react'
import { Animated, Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { Sidebar } from '../shared/sidebar.js'
import { HintBubble, useHint } from '../shared/hint-bubble.js'
import { BlobBackground } from '../dashboard/household-dashboard.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ChefHatIcon } from '../dashboard/dashboard-icons.js'
import { useRecipesQuery } from '../../application/recipe/recipes.query.js'
import type { Recipe } from '../../domain/recipe/recipe.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'

const TABLET_BREAKPOINT = 768

function BackButton({ onPress, ink, cream }: { onPress: () => void; ink: string; cream: string }) {
  const hover = useHoverPress()
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      style={pointerCursor}
    >
      <Animated.View
        style={{
          transform: [{ scale: hover.scale }],
          width: 44,
          height: 44,
          borderRadius: 999,
          backgroundColor: cream,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text fontSize={18} fontWeight="800" color={ink}>
          ←
        </Text>
      </Animated.View>
    </Pressable>
  )
}

function TagChip({ label, palette }: { label: string; palette: SoftPalette }) {
  return (
    <XStack backgroundColor={palette.mintPale} borderRadius={999} paddingVertical="$1" paddingHorizontal="$2.5">
      <Text fontSize={11} fontWeight="700" color={palette.mintPaleText}>
        {label}
      </Text>
    </XStack>
  )
}

function RecipeCard({ recipe, onPress, corner }: { recipe: Recipe; onPress: () => void; corner: 'a' | 'b' }) {
  const palette = useSoftPalette()
  const hover = useHoverPress()
  const radii =
    corner === 'a'
      ? { borderTopLeftRadius: 24, borderTopRightRadius: 14, borderBottomRightRadius: 24, borderBottomLeftRadius: 14 }
      : { borderTopLeftRadius: 14, borderTopRightRadius: 24, borderBottomRightRadius: 14, borderBottomLeftRadius: 24 }
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }] }}>
        <XStack
          gap="$3"
          padding="$3.5"
          backgroundColor={palette.gradientBottom}
          style={{ ...radii, shadowColor: palette.shadowCool, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2 }}
        >
          <YStack width={44} height={44} borderRadius={14} backgroundColor={palette.mintPale} alignItems="center" justifyContent="center">
            <ChefHatIcon size={20} color={palette.mintPaleText} />
          </YStack>
          <YStack flex={1} gap="$1.5">
            <Text fontSize={15} fontWeight="800" color={palette.ink}>
              {recipe.title}
            </Text>
            {recipe.description ? (
              <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} numberOfLines={2}>
                {recipe.description}
              </Text>
            ) : null}
            <XStack gap="$1.5" flexWrap="wrap" marginTop="$1">
              {recipe.preparationTime ? <TagChip label={`${recipe.preparationTime} min`} palette={palette} /> : null}
              {recipe.tags.slice(0, 2).map((tag) => (
                <TagChip key={tag} label={tag} palette={palette} />
              ))}
            </XStack>
          </YStack>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}

function RecipeListContent({ onOpenRecipe }: { onOpenRecipe: (recipe: Recipe) => void }) {
  const palette = useSoftPalette()
  const { width } = useWindowDimensions()
  const isWide = width >= TABLET_BREAKPOINT
  const recipesQuery = useRecipesQuery()
  const recipes = recipesQuery.data ?? []

  return (
    <YStack flex={1} minHeight={0} backgroundColor={palette.gradientBottom} style={{ position: 'relative' }}>
      <BlobBackground blobStrong={palette.blobStrong} blobSoft={palette.blobSoft} ground={palette.gradientBottom} />
      <SafeAreaView style={{ flex: 1, minHeight: 0 }} edges={isWide ? [] : ['top', 'bottom']}>
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 40,
            paddingTop: isWide ? 32 : 20,
            maxWidth: isWide ? 640 : undefined,
            width: isWide ? '100%' : undefined,
            alignSelf: isWide ? 'center' : undefined,
          }}
        >
          <XStack alignItems="center" gap="$3">
            {isWide ? null : <BackButton onPress={() => router.back()} ink={palette.ink} cream={palette.cream} />}
            <YStack>
              <Text fontSize={20} fontWeight="800" color={palette.ink}>
                Recettes
              </Text>
              <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} marginTop="$0.5">
                {recipesQuery.isPending ? 'Chargement...' : `${recipes.length} recette${recipes.length > 1 ? 's' : ''}`}
              </Text>
            </YStack>
          </XStack>

          {recipesQuery.isError ? (
            <XStack backgroundColor={palette.expiredBg} borderRadius={14} padding="$3" marginTop="$4">
              <Text fontSize={13} fontWeight="600" color={palette.expiredText} flex={1}>
                Impossible de charger les recettes.
              </Text>
            </XStack>
          ) : null}

          {!recipesQuery.isPending && recipes.length === 0 ? (
            <YStack alignItems="center" gap="$2" marginTop="$8">
              <ChefHatIcon size={32} color={palette.inkSecondary} />
              <Text fontSize={14} fontWeight="600" color={palette.inkSecondary}>
                Aucune recette pour l’instant
              </Text>
            </YStack>
          ) : null}

          <YStack gap="$3" marginTop="$5">
            {recipes.map((recipe, index) => (
              <RecipeCard key={recipe.id} recipe={recipe} corner={index % 2 === 0 ? 'a' : 'b'} onPress={() => onOpenRecipe(recipe)} />
            ))}
          </YStack>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  )
}

export function RecipeListScreen() {
  const palette = useSoftPalette()
  const { width } = useWindowDimensions()
  const isWide = width >= TABLET_BREAKPOINT
  const [streakDays] = useState(12) // same synthetic streak as the dashboard fixture — see dashboard.fixture.ts's disclosed gap
  const [hint, showHint] = useHint()

  function handleOpenRecipe(recipe: Recipe) {
    showHint(`${recipe.title} — bientôt disponible`)
  }

  if (!isWide) {
    return (
      <YStack flex={1} style={{ position: 'relative' }}>
        <RecipeListContent onOpenRecipe={handleOpenRecipe} />
        <HintBubble hint={hint} palette={palette} />
      </YStack>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, minHeight: 0, backgroundColor: palette.layoutSurface }} edges={['top', 'bottom']}>
      <XStack flex={1} minHeight={0} backgroundColor={palette.layoutSurface}>
        <Sidebar
          palette={palette}
          streakDays={streakDays}
          active="recettes"
          onOpenFrigo={() => router.push('/(tabs)')}
          onOpenRecettes={() => {}}
          onOpenCourses={() => router.push('/(tabs)/shopping-list')}
          onScan={() => showHint('Scanner — bientôt disponible')}
        />
        <YStack flex={1} minHeight={0} padding="$4" style={{ position: 'relative' }}>
          <YStack
            flex={1}
            minHeight={0}
            overflow="hidden"
            style={{
              borderRadius: 28,
              shadowColor: palette.shadowWarm,
              shadowOffset: { width: 0, height: 14 },
              shadowOpacity: 0.2,
              shadowRadius: 26,
              elevation: 4,
            }}
          >
            <RecipeListContent onOpenRecipe={handleOpenRecipe} />
          </YStack>
          <HintBubble hint={hint} palette={palette} />
        </YStack>
      </XStack>
    </SafeAreaView>
  )
}
