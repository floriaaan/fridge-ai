import { useEffect, useRef, useState } from 'react'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { KeyboardAvoidingView, Platform } from 'react-native'
import { AppShell } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { FormCard } from '../shared/form-card.js'
import { AuthButton } from '../identity/auth-button.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { PencilIcon, ScaleIcon, ShoppingCartIcon } from '../dashboard/dashboard-icons.js'
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
        ? // `source: 'manual'` — this form is the hand-typed entry point;
          // `CreateShoppingItemInput` requires it (backend validator has no
          // default), `UpdateShoppingItemInput` has no such field at all.
          await createItem.mutateAsync({ ...payload, source: 'manual' })
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
    <AppShell
      nav={{ kind: 'stack' }}
      header={
        <ScreenHeader
          palette={palette}
          icon={(color) => <ShoppingCartIcon size={19} color={color} />}
          title={props.mode === 'create' ? 'Ajouter un article' : "Modifier l'article"}
          onBack={() => router.back()}
        />
      }
    >
      {/* The one form screen that was missing it: three fields and a submit
          pill, with the keyboard free to cover the pill. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <YStack marginTop="$2">
        <FormCard palette={palette} gap="$3">
          <FormField
            testID="shopping-item-form-name"
            label="Nom"
            value={name}
            onChangeText={setName}
            palette={palette}
            icon={(color) => <PencilIcon size={13} color={color} />}
          />
          <FormField
            testID="shopping-item-form-amount"
            label="Quantité"
            value={amount}
            onChangeText={setAmount}
            palette={palette}
            keyboardType="number-pad"
            icon={(color) => <ScaleIcon size={13} color={color} />}
          />
          <FormField
            testID="shopping-item-form-unit"
            label="Unité"
            value={unit}
            onChangeText={setUnit}
            palette={palette}
            autoCapitalize="none"
          />

          {error ? (
            <Text fontSize={13} color={palette.expiredText}>
              {error}
            </Text>
          ) : null}

          <AuthButton
            testID="shopping-item-form-submit"
            label="Enregistrer"
            pendingLabel="Enregistrement..."
            pending={pending}
            onPress={handleSubmit}
          />
        </FormCard>
      </YStack>
      </KeyboardAvoidingView>
    </AppShell>
  )
}
