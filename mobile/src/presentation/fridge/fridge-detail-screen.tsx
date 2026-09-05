/*
 * One product, and the two things a foyer member does with it: finish it,
 * or correct it.
 *
 * Three fixes from a usability critique live here. The delete confirmation
 * used to render *at the same screen position* as the trigger, so a second
 * impatient tap destroyed a product on shared state with no dialog and no
 * undo — it is now a titled ActionSheet that names the consequence. The
 * screen showed a raw `Expire le 12/09/2026` with no status chip, breaking
 * DESIGN.md's own "every status is icon + color + word" invariant on the
 * one screen where expiry is the subject. And finishing the milk could
 * only be expressed as deletion, through the edit form.
 */
import { useState } from 'react'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { BackButton } from '../shared/back-button.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { AuthButton } from '../identity/auth-button.js'
import { useHint } from '../shared/hint-bubble.js'
import { goBack } from '../shared/navigation.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { StatusChip } from '../dashboard/status-chip.js'
import { CircleCheckIcon, XIcon } from '../dashboard/dashboard-icons.js'
import { daysUntilExpiry, expiryLabel, statusOf } from '../dashboard/product-status.js'
import { useProductQuery } from '../../application/fridge/product.query.js'
import { useDeleteProductMutation } from '../../application/fridge/delete-product.mutation.js'
import { useUpdateProductMutation } from '../../application/fridge/update-product.mutation.js'

const LOCATION_LABEL = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' } as const

export function FridgeDetailScreen({ productId }: { productId: string }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const product = useProductQuery(productId)
  const deleteProduct = useDeleteProductMutation()
  const updateProduct = useUpdateProductMutation()
  const [hint, showHint] = useHint()
  const [confirming, setConfirming] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    setConfirming(false)
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

  async function handleConsumeOne(amount: number, unit: string) {
    setDeleteError(null)
    const result = await updateProduct.mutateAsync({
      productId,
      patch: { quantity: { amount: amount - 1, unit } },
    })
    if (!result.ok) {
      setDeleteError(result.error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['product', productId] })
    showHint(`Il en reste ${amount - 1} ${unit}`)
  }

  const header = (
    <XStack alignItems="center" gap="$3">
      <BackButton onPress={() => goBack('/(tabs)/fridge')} ink={palette.ink} cream={palette.cream} />
      <Text fontSize={20} fontWeight="800" color={palette.ink}>
        Produit
      </Text>
    </XStack>
  )

  // The post-delete frame used to be a naked `<Text>` outside AppShell — no
  // background, no safe area, no way back — reachable on web where the pop
  // may not unmount the screen.
  if (deleted) {
    return (
      <AppShell nav={{ kind: 'stack' }}>
        {header}
        <YStack alignItems="center" gap="$2" marginTop="$8">
          <Text testID="fridge-detail-deleted" fontSize={15} fontWeight="700" color={palette.ink}>
            Produit supprimé
          </Text>
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
            Il a disparu du frigo de tout le foyer.
          </Text>
        </YStack>
      </AppShell>
    )
  }

  if (!product.data) {
    return (
      <AppShell nav={{ kind: 'stack' }}>
        {header}
        <YStack marginTop="$5">
          <Text color={palette.inkSecondary}>{product.isLoading ? 'Chargement...' : 'Produit introuvable.'}</Text>
        </YStack>
      </AppShell>
    )
  }

  const p = product.data
  const daysLeft = daysUntilExpiry(p)
  const status = statusOf(daysLeft)
  const statusBg = status === 'expired' ? palette.expiredBg : status === 'soon' ? palette.soonBg : palette.freshBg
  const statusColor = status === 'expired' ? palette.expiredText : status === 'soon' ? palette.soonText : palette.freshText
  const lastUnit = p.quantity.amount <= 1

  return (
    <>
    <AppShell nav={{ kind: 'stack' }} hint={hint}>
      {header}
      <YStack gap="$3" marginTop="$5">
        <Text fontSize={24} fontWeight="800" color={palette.ink} lineHeight={30}>
          {p.name}
        </Text>

        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <StatusChip status={status} bg={statusBg} color={statusColor} />
          <Text fontSize={13} fontWeight="600" color={palette.inkSecondary}>
            {expiryLabel(daysLeft)}
          </Text>
        </XStack>

        <YStack gap="$2" marginTop="$2">
          <DetailRow label="Quantité" value={`${p.quantity.amount} ${p.quantity.unit}`} palette={palette} />
          <DetailRow label="Emplacement" value={LOCATION_LABEL[p.location]} palette={palette} />
          <DetailRow label="Catégorie" value={p.category} palette={palette} />
          {p.expiresAt ? (
            <DetailRow label="Date de péremption" value={new Date(p.expiresAt).toLocaleDateString('fr-FR')} palette={palette} />
          ) : null}
        </YStack>

        <YStack marginTop="$5" gap="$2">
          {/* The most frequent kitchen verb had no control at all: finishing
              a product meant opening the edit form and retyping a quantity. */}
          <AuthButton
            testID="fridge-detail-consume"
            label={lastUnit ? 'J’ai fini ce produit' : 'J’en ai consommé un'}
            pendingLabel="Mise à jour..."
            pending={updateProduct.isPending}
            icon={<CircleCheckIcon size={16} color={palette.accentLimeText} />}
            onPress={() => (lastUnit ? setConfirming(true) : handleConsumeOne(p.quantity.amount, p.quantity.unit))}
          />

          <AuthButton
            testID="fridge-detail-edit"
            label="Modifier"
            variant="secondary"
            onPress={() => router.push({ pathname: '/(tabs)/fridge/[id]/edit', params: { id: productId } })}
          />

          <AuthButton
            testID="fridge-detail-delete"
            label="Retirer du frigo"
            variant="secondary"
            onPress={() => setConfirming(true)}
          />

          {deleteError ? (
            <Text
              testID="fridge-detail-delete-error"
              fontSize={13}
              fontWeight="600"
              color={palette.expiredText}
              accessibilityLiveRegion="polite"
            >
              {deleteError}
            </Text>
          ) : null}
        </YStack>
      </YStack>
    </AppShell>
    <ActionSheet
      visible={confirming}
      onClose={() => setConfirming(false)}
      title={`Retirer « ${p.name} » ?`}
      description="C’est définitif, et le produit disparaît aussi du frigo des autres membres du foyer."
      options={[
        {
          testID: 'fridge-detail-delete-confirm',
          label: 'Retirer du frigo',
          icon: (color) => <XIcon size={18} color={color} />,
          tint: palette.expired,
          destructive: true,
          onPress: handleDelete,
        },
      ]}
    />
    </>
  )
}

function DetailRow({ label, value, palette }: { label: string; value: string; palette: SoftPalette }) {
  return (
    <XStack justifyContent="space-between" alignItems="center" gap="$3">
      <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
        {label}
      </Text>
      <Text fontSize={14} fontWeight="700" color={palette.ink} flex={1} textAlign="right">
        {value}
      </Text>
    </XStack>
  )
}
