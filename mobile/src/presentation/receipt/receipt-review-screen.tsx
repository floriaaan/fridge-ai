/*
 * The screen the whole "photographie ton ticket" promise lands on.
 *
 * It used to undo that promise: every extracted line rendered six text
 * inputs and a location picker, all expanded, inside one un-virtualized
 * card with no keyboard avoidance — a 20-line receipt meant 120 visible
 * text fields, more typing than adding the products by hand. There was no
 * way to drop a line the AI misread, "Réessayer" threw away the photo the
 * user had just taken, the 10-30s AI call was a single static line of
 * text, and a successful import dropped the user on a dashboard that said
 * their fridge was unchanged.
 *
 * Now: collapsed rows to approve rather than retype, per-row delete, a
 * bulk "range tout ici" control, per-field errors on the offending row,
 * retry on the same photo, and an explicit success state that says what
 * landed in the fridge.
 */
import { useEffect, useRef, useState } from 'react'
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell, shellContentStyle, useAppShellLayout } from '../shared/app-shell.js'
import { ScreenHeader } from '../shared/screen-header.js'
import { PulseDots } from '../shared/pulse-dots.js'
import { FormCard } from '../shared/form-card.js'
import { AuthButton } from '../identity/auth-button.js'
import { pointerCursor } from '../shared/hover.js'
import { goBack } from '../shared/navigation.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import { CalendarIcon, CircleCheckIcon, ReceiptIcon, StoreIcon, WalletIcon } from '../dashboard/dashboard-icons.js'
import { FormField } from '../fridge/form-field.js'
import { ReceiptItemRow, type EditableReceiptItem, type ReceiptItemErrors } from './receipt-item-row.js'
import { useScanReceiptMutation } from '../../application/receipt/scan-receipt.mutation.js'
import { useImportReceiptMutation } from '../../application/receipt/import-receipt.mutation.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'
import type { ReceiptDraftItem } from '../../domain/receipt/receipt-draft.js'

const LOCATION_LABELS: Record<LocationValue, string> = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' }

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
  const nav = { kind: 'stack' as const }
  const { isWide, hasMobileNav } = useAppShellLayout(nav)

  const [storeName, setStoreName] = useState('')
  const [scannedAt, setScannedAt] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [items, setItems] = useState<EditableReceiptItem[]>([])
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [itemErrors, setItemErrors] = useState<Record<number, ReceiptItemErrors>>({})
  const [scanError, setScanError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [imported, setImported] = useState<number | null>(null)
  const startedRef = useRef(false)

  async function runScan() {
    setScanError(null)
    const result = await scanReceipt.mutateAsync(imageUri)
    if (!result.ok) {
      setScanError('Extraction impossible, réessaie ou reprends la photo.')
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

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index))
    setItemErrors({})
    setExpandedIndex((current) => (current === index ? null : current !== null && current > index ? current - 1 : current))
  }

  function setAllLocations(location: LocationValue) {
    setItems((current) => current.map((item) => ({ ...item, location })))
  }

  /** Collects every bad field instead of aborting on the first one. */
  function validate() {
    const errors: Record<number, ReceiptItemErrors> = {}
    const parsed: {
      name: string
      quantity: number
      unit: string
      category: string | null
      price: number | null
      location: LocationValue
      expiresAt: string | null
    }[] = []

    items.forEach((item, index) => {
      const rowErrors: ReceiptItemErrors = {}

      if (item.name.trim().length === 0) rowErrors.name = 'Donne un nom à cet article.'

      const quantity = Number(item.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) rowErrors.quantity = 'Quantité invalide.'

      let price: number | null = null
      if (item.price.trim().length > 0) {
        price = Number(item.price)
        if (!Number.isFinite(price) || price <= 0) rowErrors.price = 'Prix invalide.'
      }

      const expiresAt = parseDateOrNull(item.expiresAt)
      if (expiresAt === 'invalid') rowErrors.expiresAt = 'Date invalide (AAAA-MM-JJ).'

      if (Object.keys(rowErrors).length > 0) {
        errors[index] = rowErrors
        return
      }

      parsed.push({
        name: item.name.trim(),
        quantity,
        unit: item.unit.trim(),
        category: item.category.trim().length > 0 ? item.category.trim() : null,
        price,
        location: item.location,
        expiresAt: expiresAt as string | null,
      })
    })

    return { errors, parsed }
  }

  async function handleSubmit() {
    setSubmitError(null)
    setItemErrors({})

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

    const { errors, parsed } = validate()
    const badIndexes = Object.keys(errors).map(Number)
    if (badIndexes.length > 0) {
      setItemErrors(errors)
      // Open the first offending row: an error you cannot see is an error
      // you cannot fix, and the row is collapsed by default.
      setExpandedIndex(badIndexes[0])
      setSubmitError(
        badIndexes.length === 1
          ? 'Un article est à corriger.'
          : `${badIndexes.length} articles sont à corriger.`,
      )
      return
    }

    const result = await importReceipt.mutateAsync({
      storeName: storeName.trim(),
      scannedAt: parsedScannedAt ?? new Date().toISOString(),
      totalAmount: parsedTotalAmount,
      items: parsed,
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
    queryClient.invalidateQueries({ queryKey: ['receipts'] })
    setImported(result.value.products.length)
  }

  const header = (
    <ScreenHeader
      palette={palette}
      icon={(color) => <ReceiptIcon size={19} color={color} />}
      title="Vérifier le ticket"
      subtitle={
        items.length > 0 && imported === null
          ? `${items.length} article${items.length > 1 ? 's' : ''} extrait${items.length > 1 ? 's' : ''} — corrige ce qui cloche, le reste part tel quel.`
          : undefined
      }
      onBack={() => goBack('/receipts')}
    />
  )

  if (imported !== null) {
    return (
      <AppShell nav={nav} header={header}>
        <YStack alignItems="center" gap="$3" marginTop="$8">
          <YStack width={64} height={64} borderRadius={999} backgroundColor={palette.freshBg} alignItems="center" justifyContent="center">
            <CircleCheckIcon size={30} color={palette.freshText} />
          </YStack>
          <Text testID="receipt-review-success" fontSize={20} fontWeight="800" color={palette.ink} textAlign="center">
            {imported} produit{imported > 1 ? 's' : ''} ajouté{imported > 1 ? 's' : ''} au garde-manger
          </Text>
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">
            Ton foyer les voit déjà.
          </Text>
          <YStack width="100%" gap="$2" marginTop="$4">
            <AuthButton
              testID="receipt-review-open-fridge"
              label="Voir le garde-manger"
              onPress={() => router.replace('/(tabs)/fridge')}
            />
            <AuthButton
              testID="receipt-review-scan-another"
              label="Scanner un autre ticket"
              variant="secondary"
              onPress={() => router.replace('/receipts/scan')}
            />
          </YStack>
        </YStack>
      </AppShell>
    )
  }

  if (scanReceipt.isPending && items.length === 0) {
    return (
      <AppShell nav={nav} header={header}>
        <YStack alignItems="center" gap="$3" marginTop="$8">
          {/* The same wait, drawn the same way as the recipe composer's — see
              DESIGN.md: a wait with no measurable progress is `PulseDots`, not
              the platform's wheel. This one is the app's longest. */}
          <PulseDots palette={palette} size={12} testID="receipt-reading-dots" label="Lecture du ticket en cours" />
          <Text fontSize={15} fontWeight="700" color={palette.ink}>
            Lecture du ticket…
          </Text>
          <Text fontSize={13} fontWeight="500" color={palette.inkSecondary} textAlign="center">
            L’IA lit chaque ligne de ta photo. Ça prend en général une dizaine de secondes.
          </Text>
        </YStack>
      </AppShell>
    )
  }

  if (scanError) {
    return (
      <AppShell nav={nav} header={header}>
        <YStack gap="$3" marginTop="$8">
          <Text fontSize={14} color={palette.expiredText} textAlign="center">
            {scanError}
          </Text>
          {/* Retry re-reads the same photo. It used to route back to the
              camera, throwing away the shot the user had just framed. */}
          <AuthButton
            testID="receipt-review-retry"
            label="Réessayer"
            pendingLabel="Lecture..."
            pending={scanReceipt.isPending}
            onPress={runScan}
          />
          <AuthButton
            testID="receipt-review-retake"
            label="Reprendre la photo"
            variant="secondary"
            onPress={() => router.replace('/receipts/scan')}
          />
        </YStack>
      </AppShell>
    )
  }

  const listHeader = (
    <YStack gap="$4" marginBottom="$2">
      {/* The shot itself: the user has to be able to check a line against
          the paper it came from. It was passed in and never displayed. */}
      <Image
        testID="receipt-review-photo"
        source={{ uri: imageUri }}
        resizeMode="cover"
        accessibilityLabel="Photo du ticket scanné"
        style={{
          width: '100%',
          height: 140,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 14,
          borderBottomRightRadius: 24,
          borderBottomLeftRadius: 14,
          backgroundColor: palette.cream,
        }}
      />
      <FormCard palette={palette} gap="$3">
        <FormField
          testID="receipt-review-store-name"
          label="Magasin"
          value={storeName}
          onChangeText={setStoreName}
          palette={palette}
          icon={(color) => <StoreIcon size={13} color={color} />}
        />
        <XStack gap="$2">
          <YStack flex={1}>
            <FormField
              testID="receipt-review-scanned-at"
              label="Date du ticket"
              value={scannedAt}
              onChangeText={setScannedAt}
              palette={palette}
              keyboardType="numbers-and-punctuation"
              placeholder="AAAA-MM-JJ"
              icon={(color) => <CalendarIcon size={13} color={color} />}
            />
          </YStack>
          <YStack flex={1}>
            <FormField
              testID="receipt-review-total-amount"
              label="Total (€)"
              value={totalAmount}
              onChangeText={setTotalAmount}
              palette={palette}
              keyboardType="decimal-pad"
              icon={(color) => <WalletIcon size={13} color={color} />}
            />
          </YStack>
        </XStack>
      </FormCard>

      <YStack gap="$2">
        <Text fontSize={12} fontWeight="700" color={palette.inkSecondary}>
          Tout ranger dans
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {LOCATIONS.map((location) => (
            <Pressable
              key={location}
              testID={`receipt-review-all-${location}`}
              onPress={() => setAllLocations(location)}
              accessibilityRole="button"
              accessibilityLabel={`Ranger tous les articles dans ${LOCATION_LABELS[location]}`}
              style={pointerCursor}
            >
              <XStack alignItems="center" minHeight={44} paddingHorizontal="$4" borderRadius={999} backgroundColor={palette.cream}>
                <Text fontSize={13} fontWeight="700" color={palette.creamText}>
                  {LOCATION_LABELS[location]}
                </Text>
              </XStack>
            </Pressable>
          ))}
        </XStack>
      </YStack>
    </YStack>
  )

  const listFooter = (
    <YStack gap="$2" marginTop="$3">
      {submitError ? (
        <Text
          testID="receipt-review-error"
          fontSize={13}
          fontWeight="600"
          color={palette.expiredText}
          accessibilityLiveRegion="polite"
        >
          {submitError}
        </Text>
      ) : null}
      <AuthButton
        testID="receipt-review-submit"
        label={items.length > 0 ? `Importer ${items.length} article${items.length > 1 ? 's' : ''}` : 'Importer'}
        pendingLabel="Importation..."
        pending={importReceipt.isPending}
        onPress={handleSubmit}
      />
    </YStack>
  )

  return (
    <AppShell nav={nav} scrollable={false} header={header}>
      <KeyboardAvoidingView
        style={{ flex: 1, minHeight: 0 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Virtualized: a long receipt is a long list, and it used to render
            every row's seven controls at once inside a plain ScrollView. */}
        <FlatList
          data={items}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={shellContentStyle({ isWide, hasMobileNav })}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          ListEmptyComponent={<EmptyItems palette={palette} />}
          renderItem={({ item, index }) => (
            <ReceiptItemRow
              index={index}
              item={item}
              expanded={expandedIndex === index}
              onToggle={() => setExpandedIndex((current) => (current === index ? null : index))}
              onChange={(next) => updateItem(index, next)}
              onRemove={() => removeItem(index)}
              errors={itemErrors[index]}
            />
          )}
        />
      </KeyboardAvoidingView>
    </AppShell>
  )
}

function EmptyItems({ palette }: { palette: SoftPalette }) {
  return (
    <YStack gap="$2" paddingVertical="$4">
      <Text fontSize={14} fontWeight="700" color={palette.ink}>
        Aucun article sur ce ticket
      </Text>
      <Text fontSize={13} fontWeight="500" color={palette.inkSecondary}>
        L’IA n’a rien reconnu, ou tu as tout retiré. Reprends la photo en cadrant le ticket entier.
      </Text>
    </YStack>
  )
}
