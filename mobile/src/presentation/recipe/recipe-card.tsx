import { Animated, Pressable } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { ChefHatIcon } from '../dashboard/dashboard-icons.js'
import { TagChip } from './tag-chip.js'
import type { Recipe } from '../../domain/recipe/recipe.js'

export function RecipeCard({ recipe, onPress, corner }: { recipe: Recipe; onPress: () => void; corner: 'a' | 'b' }) {
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
