import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { FormField } from '../fridge/form-field.js'
import { ReceiptItemRow, type EditableReceiptItem } from './receipt-item-row.js'
import { useScanReceiptMutation } from '../../application/receipt/scan-receipt.mutation.js'
import { useImportReceiptMutation } from '../../application/receipt/import-receipt.mutation.js'
import type { ReceiptDraftItem } from '../../domain/receipt/receipt-draft.js'

function toEditable(item: ReceiptDraftItem): EditableReceiptItem {
  return {
    name: item.name,
    quantity: String(item.quantity),
    unit: item.unit,
    category: item.category ?? '',
    price: item.price !== null ? String(item.price) : '',
    location: 'fridge',
    expiresAt: '',
  }
}

export function ReceiptReviewScreen({ imageUri }: { imageUri: string }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()
  const scanReceipt = useScanReceiptMutation()
  const importReceipt = useImportReceiptMutation()

  const [storeName, setStoreName] = useState('')
  const [scannedAt, setScannedAt] = useState('')
  const [totalAmount, setTotalAmount] = useState(0)
  const [items, setItems] = useState<EditableReceiptItem[]>([])
  const [scanError, setScanError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const startedRef = useRef(false)

  async function runScan() {
    setScanError(null)
    const result = await scanReceipt.mutateAsync(imageUri)
    if (!result.ok) {
      setScanError('Extraction impossible, réessaie ou vérifie ta photo.')
      return
    }
    setStoreName(result.value.storeName)
    setScannedAt(result.value.scannedAt.slice(0, 10))
    setTotalAmount(result.value.totalAmount)
    setItems(result.value.items.map(toEditable))
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    runScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateItem(index: number, next: EditableReceiptItem) {
    setItems((current) => current.map((item, i) => (i === index ? next : item)))
  }

  async function handleSubmit() {
    setSubmitError(null)
    const parsedItems = []
    for (const item of items) {
      const quantity = Number(item.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setSubmitError(`Quantité invalide pour "${item.name || 'un article'}".`)
        return
      }
      if (item.name.trim().length === 0) {
        setSubmitError('Chaque article doit avoir un nom.')
        return
      }
      parsedItems.push({
        name: item.name.trim(),
        quantity,
        unit: item.unit.trim(),
        category: item.category.trim().length > 0 ? item.category.trim() : null,
        price: item.price.trim().length > 0 ? Number(item.price) : null,
        location: item.location,
        expiresAt: item.expiresAt.trim().length > 0 ? new Date(item.expiresAt.trim()).toISOString() : null,
      })
    }

    const result = await importReceipt.mutateAsync({
      storeName: storeName.trim(),
      scannedAt: scannedAt.trim().length > 0 ? new Date(scannedAt.trim()).toISOString() : new Date().toISOString(),
      totalAmount,
      items: parsedItems,
    })

    if (!result.ok) {
      setSubmitError(result.error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['products'] })
    router.replace('/(tabs)')
  }

  if (scanReceipt.isPending && items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Text fontSize={14} color={palette.ink}>
            Analyse du ticket en cours…
          </Text>
        </YStack>
      </SafeAreaView>
    )
  }

  if (scanError) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4" gap="$3" alignItems="center" justifyContent="center">
          <Text fontSize={14} color={palette.expiredText} textAlign="center">
            {scanError}
          </Text>
          <Pressable
            testID="receipt-review-retry"
            onPress={runScan}
            accessibilityRole="button"
            accessibilityLabel="Réessayer"
            style={pointerCursor}
          >
            <YStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$2.5" paddingHorizontal="$4">
              <Text fontWeight="800" color={palette.accentLimeText}>
                Réessayer
              </Text>
            </YStack>
          </Pressable>
        </YStack>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: palette.gradientBottom }} contentContainerStyle={{ padding: 16 }}>
        <Text fontSize={20} fontWeight="800" color={palette.ink} marginBottom={12}>
          Vérifier le ticket
        </Text>

        <FormField testID="receipt-review-store-name" label="Magasin" value={storeName} onChangeText={setStoreName} color={palette.ink} />
        <FormField
          testID="receipt-review-scanned-at"
          label="Date (AAAA-MM-JJ)"
          value={scannedAt}
          onChangeText={setScannedAt}
          color={palette.ink}
        />
        <Text fontSize={13} color={palette.inkSecondary} marginTop={4} marginBottom={12}>
          Total : {totalAmount.toFixed(2)} €
        </Text>

        {items.map((item, index) => (
          <ReceiptItemRow key={index} index={index} item={item} onChange={(next) => updateItem(index, next)} />
        ))}

        {submitError ? (
          <Text fontSize={13} color={palette.expiredText} marginBottom={8}>
            {submitError}
          </Text>
        ) : null}

        <Pressable
          testID="receipt-review-submit"
          onPress={handleSubmit}
          disabled={importReceipt.isPending}
          accessibilityRole="button"
          accessibilityLabel="Importer"
          style={pointerCursor}
        >
          <YStack backgroundColor={palette.accentLime} borderRadius={999} paddingVertical="$3" alignItems="center">
            <Text fontWeight="800" color={palette.accentLimeText}>
              Importer
            </Text>
          </YStack>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
