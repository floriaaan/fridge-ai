import { useLocalSearchParams } from 'expo-router'
import { RecipeDetailScreen } from '../../../presentation/recipe/recipe-detail-screen.js'

export default function RecipeDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <RecipeDetailScreen recipeId={id} />
}
