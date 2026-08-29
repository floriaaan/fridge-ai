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
import { ScrollView, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { Sidebar } from '../shared/sidebar.js'
import { HintBubble, useHint } from '../shared/hint-bubble.js'
import { BlobBackground } from '../shared/blob-background.js'
import { BackButton } from '../shared/back-button.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ChefHatIcon } from '../dashboard/dashboard-icons.js'
import { RecipeCard } from './recipe-card.js'
import { useRecipesQuery } from '../../application/recipe/recipes.query.js'
import type { Recipe } from '../../domain/recipe/recipe.js'

const TABLET_BREAKPOINT = 768

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
