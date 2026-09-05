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
 */
import { Animated, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { useHint } from '../shared/hint-bubble.js'
import { useScanSheet } from '../shared/scan-sheet.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { ChefHatIcon } from '../dashboard/dashboard-icons.js'
import { RecipeCard } from './recipe-card.js'
import { useRecipesQuery } from '../../application/recipe/recipes.query.js'
import { useGenerateRecipesMutation } from '../../application/recipe/generate-recipes.mutation.js'
import type { Recipe } from '../../domain/recipe/recipe.js'

export function RecipeListScreen() {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const [hint, showHint] = useHint()
  const { openScanSheet, scanSheet } = useScanSheet()
  const recipesQuery = useRecipesQuery()
  const generate = useGenerateRecipesMutation()
  const recipes = recipesQuery.data ?? []

  function handleOpenRecipe(recipe: Recipe) {
    router.push({ pathname: '/(tabs)/recipes/[id]', params: { id: recipe.id } })
  }

  async function handleGenerate() {
    if (generate.isPending) return
    const result = await generate.mutateAsync(undefined)
    if (!result.ok) {
      showHint(result.error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['recipes'] })
    const [first] = result.value
    if (first) router.push({ pathname: '/(tabs)/recipes/[id]', params: { id: first.id } })
  }

  return (
    <>
    <AppShell nav={{ kind: 'tab', tab: 'recettes', onScan: openScanSheet }} hint={hint}>
      <XStack alignItems="center" gap="$3">
        <YStack>
          <Text fontSize={20} fontWeight="800" color={palette.ink}>
            Recettes
          </Text>
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} marginTop="$0.5">
            {recipesQuery.isPending ? 'Chargement...' : `${recipes.length} recette${recipes.length > 1 ? 's' : ''}`}
          </Text>
        </YStack>
      </XStack>

      <GenerateButton
        label={generate.isPending ? 'Génération en cours…' : 'Générer une recette'}
        caption={generate.isPending ? 'On regarde ce qui périme en premier.' : 'À partir de ce qui périme bientôt.'}
        pending={generate.isPending}
        onPress={handleGenerate}
        palette={palette}
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
        <YStack alignItems="center" gap="$2" marginTop="$8" paddingHorizontal="$4">
          <ChefHatIcon size={32} color={palette.inkSecondary} />
          <Text fontSize={14} fontWeight="700" color={palette.ink}>
            Aucune recette pour l’instant
          </Text>
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">
            Génère-en une à partir des produits qui périment le plus vite.
          </Text>
        </YStack>
      ) : null}

      <YStack gap="$3" marginTop="$5">
        {recipes.map((recipe, index) => (
          <RecipeCard key={recipe.id} recipe={recipe} corner={index % 2 === 0 ? 'a' : 'b'} onPress={() => handleOpenRecipe(recipe)} />
        ))}
      </YStack>
    </AppShell>
    {scanSheet}
    </>
  )
}

/**
 * Deliberately a full-width card rather than a chip: generating is the
 * screen's reason to exist, and the caption carries the one thing a user
 * needs to trust it — what it cooks from.
 */
function GenerateButton({
  label,
  caption,
  pending,
  onPress,
  palette,
}: {
  label: string
  caption: string
  pending: boolean
  onPress: () => void
  palette: SoftPalette
}) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID="recipes-generate"
      onPress={pending ? undefined : onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: pending, busy: pending }}
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }], opacity: pending ? 0.7 : 1, marginTop: 20 }}>
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
          <YStack flex={1}>
            <Text fontSize={14} fontWeight="800" color={palette.accentLimeText}>
              {label}
            </Text>
            <Text fontSize={12} fontWeight="500" color={palette.accentLimeText} opacity={0.8}>
              {caption}
            </Text>
          </YStack>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
