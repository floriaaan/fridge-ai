import { useState } from 'react'
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useProductQuery } from '../../application/fridge/product.query.js'
import { useDeleteProductMutation } from '../../application/fridge/delete-product.mutation.js'

const LOCATION_LABEL = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' } as const

export function FridgeDetailScreen({ productId }: { productId: string }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const product = useProductQuery(productId)
  const deleteProduct = useDeleteProductMutation()
  const [confirming, setConfirming] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleteError(null)
    const result = await deleteProduct.mutateAsync(productId)
    if (!result.ok) {
      setDeleteError(result.error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['products'] })
    setDeleted(true)
    router.back()
  }

  if (deleted) {
    return <Text testID="fridge-detail-deleted">Produit supprimé</Text>
  }

  if (!product.data) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4">
          <Text color={palette.inkSecondary}>{product.isLoading ? 'Chargement...' : 'Produit introuvable.'}</Text>
        </YStack>
      </SafeAreaView>
    )
  }

  const p = product.data

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} padding="$4" gap="$3" backgroundColor={palette.gradientBottom}>
        <Text fontSize={22} fontWeight="800" color={palette.ink}>
          {p.name}
        </Text>
        <Text fontSize={15} color={palette.ink}>
          {p.quantity.amount} {p.quantity.unit}
        </Text>
        <Text fontSize={14} color={palette.inkSecondary}>
          {p.category}
        </Text>
        <Text fontSize={13} color={palette.inkSecondary}>
          {LOCATION_LABEL[p.location]}
        </Text>
        {p.expiresAt ? (
          <Text fontSize={13} color={palette.inkSecondary}>
            Expire le {new Date(p.expiresAt).toLocaleDateString('fr-FR')}
          </Text>
        ) : null}

        <YStack marginTop="$4" gap="$2">
          <Pressable
            testID="fridge-detail-edit"
            onPress={() => router.push({ pathname: '/(tabs)/fridge/[id]/edit', params: { id: productId } })}
            accessibilityRole="button"
            accessibilityLabel="Modifier"
            style={pointerCursor}
          >
            <YStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$2.5" alignItems="center">
              <Text fontWeight="800" color={palette.accentLimeText}>
                Modifier
              </Text>
            </YStack>
          </Pressable>

          {confirming ? (
            <Pressable
              testID="fridge-detail-delete-confirm"
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel="Confirmer la suppression"
              style={pointerCursor}
            >
              <YStack backgroundColor={palette.expiredBg} borderRadius={999} paddingVertical="$2.5" alignItems="center">
                <Text fontWeight="800" color={palette.expiredText}>
                  Confirmer la suppression
                </Text>
              </YStack>
            </Pressable>
          ) : (
            <Pressable
              testID="fridge-detail-delete"
              onPress={() => setConfirming(true)}
              accessibilityRole="button"
              accessibilityLabel="Supprimer"
              style={pointerCursor}
            >
              <YStack borderRadius={999} paddingVertical="$2.5" alignItems="center">
                <Text fontWeight="700" color={palette.expiredText}>
                  Supprimer
                </Text>
              </YStack>
            </Pressable>
          )}

          {deleteError ? (
            <Text testID="fridge-detail-delete-error" fontSize={13} color={palette.expiredText}>
              {deleteError}
            </Text>
          ) : null}
        </YStack>
      </YStack>
    </SafeAreaView>
  )
}
