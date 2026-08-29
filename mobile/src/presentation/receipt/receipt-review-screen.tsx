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

// Distinguishes "empty" from "invalid" from "valid" so callers can decide what
// to do with each case without `new Date(...).toISOString()` throwing on an
// unparseable string (e.g. "31/12/2026" produces an Invalid Date, and calling
// `.toISOString()` on it throws a RangeError).
function parseDateOrNull(value: string): string | null | 'invalid' {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return 'invalid'
  return date.toISOString()
}

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
  const [totalAmount, setTotalAmount] = useState('')
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
    setTotalAmount(String(result.value.totalAmount))
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

    if (items.length === 0) {
      setSubmitError('Ajoute au moins un article avant d’importer.')
      return
    }

    const parsedTotalAmount = Number(totalAmount)
    if (!Number.isFinite(parsedTotalAmount) || parsedTotalAmount <= 0) {
      setSubmitError('Le montant total doit être positif.')
      return
    }

    const parsedScannedAt = parseDateOrNull(scannedAt)
    if (parsedScannedAt === 'invalid') {
      setSubmitError('Date du ticket invalide (attendu AAAA-MM-JJ).')
      return
    }

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

      let price: number | null = null
      if (item.price.trim().length > 0) {
        price = Number(item.price)
        if (!Number.isFinite(price) || price <= 0) {
          setSubmitError(`Prix invalide pour "${item.name}".`)
          return
        }
      }

      const parsedExpiresAt = parseDateOrNull(item.expiresAt)
      if (parsedExpiresAt === 'invalid') {
        setSubmitError(`Date invalide pour "${item.name}" (attendu AAAA-MM-JJ).`)
        return
      }

      parsedItems.push({
        name: item.name.trim(),
        quantity,
        unit: item.unit.trim(),
        category: item.category.trim().length > 0 ? item.category.trim() : null,
        price,
        location: item.location,
        expiresAt: parsedExpiresAt,
      })
    }

    const result = await importReceipt.mutateAsync({
      storeName: storeName.trim(),
      scannedAt: parsedScannedAt ?? new Date().toISOString(),
      totalAmount: parsedTotalAmount,
      items: parsedItems,
    })

    if (!result.ok) {
      setSubmitError(
        result.error.type === 'validation_failed'
          ? 'Certains champs sont invalides. Vérifie les articles.'
          : result.error.message,
      )
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
            onPress={() => router.replace('/(tabs)/receipts/scan')}
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
        <FormField
          testID="receipt-review-total-amount"
          label="Total (€)"
          value={totalAmount}
          onChangeText={setTotalAmount}
          color={palette.ink}
        />

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
