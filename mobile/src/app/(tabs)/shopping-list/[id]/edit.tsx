import { useLocalSearchParams } from 'expo-router'
import { ShoppingItemFormScreen } from '../../../../presentation/shopping-list/shopping-item-form-screen.js'

export default function ShoppingListEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ShoppingItemFormScreen mode="edit" itemId={id} />
}
