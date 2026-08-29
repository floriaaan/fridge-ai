import { useEffect, useRef, useState } from 'react'
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { FormField } from '../fridge/form-field.js'
import { useShoppingItemsQuery } from '../../application/shopping-list/shopping-items.query.js'
import { useCreateShoppingItemMutation } from '../../application/shopping-list/create-shopping-item.mutation.js'
import { useUpdateShoppingItemMutation } from '../../application/shopping-list/update-shopping-item.mutation.js'
import { Quantity } from '../../domain/fridge/quantity.js'

type ShoppingItemFormMode = { mode: 'create' } | { mode: 'edit'; itemId: string }

export function ShoppingItemFormScreen(props: ShoppingItemFormMode & { onSuccess?: () => void }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  // No per-id fetch exists for shopping items — the list is already cached by the
  // time a user reaches an edit route from the list screen, so edit mode reads
  // from that cache instead of adding a `GET /api/shopping-items/:id` this
  // backend doesn't have.
  const itemsQuery = useShoppingItemsQuery()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const [error, setError] = useState<string | null>(null)

  const appliedEditPrefillRef = useRef(false)
  const editItemId = props.mode === 'edit' ? props.itemId : undefined

  // Guarded one-time prefill from already-fetched cache — intentional, not the
  // cascading-renders antipattern. Disabled for the whole effect body (not just
  // the line under the first setState call) so reordering the setters below
  // can't silently drop back under the rule's radar.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (props.mode !== 'edit' || !itemsQuery.data) return
    if (appliedEditPrefillRef.current) return
    const existing = itemsQuery.data.find((i) => i.id === editItemId)
    if (!existing) return
    appliedEditPrefillRef.current = true
    setName(existing.name)
    setAmount(String(existing.quantity.amount))
    setUnit(existing.quantity.unit)
  }, [props.mode, editItemId, itemsQuery.data])
  /* eslint-enable react-hooks/set-state-in-effect */

  const createItem = useCreateShoppingItemMutation()
  const updateItem = useUpdateShoppingItemMutation()
  const pending = createItem.isPending || updateItem.isPending

  async function handleSubmit() {
    setError(null)
    if (name.trim().length === 0) {
      setError('Le nom est requis.')
      return
    }
    const quantity = Quantity.create(Number(amount), unit)
    if (!quantity.ok) {
      setError(quantity.error.message)
      return
    }

    const payload = { name: name.trim(), quantity: quantity.value }

    const result =
      props.mode === 'create'
        ? await createItem.mutateAsync(payload)
        : await updateItem.mutateAsync({ itemId: props.itemId, patch: payload })

    if (!result.ok) {
      setError(result.error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['shopping-items'] })

    if (props.onSuccess) {
      props.onSuccess()
      return
    }
    router.back()
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} padding="$4" gap="$3" backgroundColor={palette.gradientBottom}>
        <Text fontSize={20} fontWeight="800" color={palette.ink}>
          {props.mode === 'create' ? 'Ajouter un article' : "Modifier l'article"}
        </Text>

        <FormField testID="shopping-item-form-name" label="Nom" value={name} onChangeText={setName} color={palette.ink} />
        <FormField testID="shopping-item-form-amount" label="Quantité" value={amount} onChangeText={setAmount} color={palette.ink} />
        <FormField testID="shopping-item-form-unit" label="Unité" value={unit} onChangeText={setUnit} color={palette.ink} />

        {error ? (
          <Text fontSize={13} color={palette.expiredText}>
            {error}
          </Text>
        ) : null}

        <Pressable
          testID="shopping-item-form-submit"
          onPress={handleSubmit}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer"
          style={pointerCursor}
        >
          <YStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$2.5" alignItems="center">
            <Text fontWeight="800" color={palette.accentLimeText}>
              {pending ? 'Enregistrement...' : 'Enregistrer'}
            </Text>
          </YStack>
        </Pressable>
      </YStack>
    </SafeAreaView>
  )
}
