/*
 * The form a user fills standing at an open fridge, holding groceries.
 *
 * It used to be five free-text fields — including a hand-typed ISO expiry
 * date — on the full QWERTY keyboard, ~40 keystrokes per product, with the
 * barcode scan (the product's own "scanne plutôt que taper" principle)
 * rendered as the smallest text link on the screen. Now: scan first and
 * large, unit and expiry as chips, an optional category offered from the
 * OpenFoodFacts lookup the app already fetches, per-field errors, and a
 * guard before an accidental back throws the typing away.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor, useHoverPress } from '../shared/hover.js'
import { AppShell } from '../shared/app-shell.js'
import { BackButton } from '../shared/back-button.js'
import { FormCard } from '../shared/form-card.js'
import { Chip, CHIP_ICON_SIZE } from '../shared/chip.js'
import { ActionSheet } from '../shared/action-sheet.js'
import { AuthButton } from '../identity/auth-button.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import type { SoftPalette } from '../dashboard/soft-palette.js'
import {
  ArchiveIcon,
  CalendarIcon,
  PackageIcon,
  PencilIcon,
  RefrigeratorIcon,
  ScaleIcon,
  ScanLineIcon,
  SnowflakeIcon,
  TagIcon,
  XIcon,
} from '../dashboard/dashboard-icons.js'
import { daysUntilExpiry, expiryLabel } from '../dashboard/product-status.js'
import { FormField } from './form-field.js'
import { useProductQuery } from '../../application/fridge/product.query.js'
import { useProductLookupQuery } from '../../application/fridge/product-lookup.query.js'
import { useCreateProductMutation } from '../../application/fridge/create-product.mutation.js'
import { useUpdateProductMutation } from '../../application/fridge/update-product.mutation.js'
import { Quantity } from '../../domain/fridge/quantity.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'

type FridgeFormMode = { mode: 'create' } | { mode: 'edit'; productId: string }

const LOCATION_LABELS: Record<LocationValue, string> = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' }

/** Same glyph per compartment as the fridge screen's filters and shelf headers. */
const LOCATION_ICONS: Record<LocationValue, (color: string) => React.ReactNode> = {
  fridge: (color) => <RefrigeratorIcon size={CHIP_ICON_SIZE} color={color} />,
  freezer: (color) => <SnowflakeIcon size={CHIP_ICON_SIZE} color={color} />,
  pantry: (color) => <ArchiveIcon size={CHIP_ICON_SIZE} color={color} />,
}

/** The units a fridge actually holds. Free text stays available beside them. */
const UNIT_SUGGESTIONS = ['g', 'kg', 'mL', 'L', 'pièce(s)']

/** Category the backend gets when the user leaves the field empty — it requires one. */
const DEFAULT_CATEGORY = 'Autre'

const DATE_SHORTCUTS: { label: string; days: number | null }[] = [
  { label: '3 jours', days: 3 },
  { label: '1 semaine', days: 7 },
  { label: '1 mois', days: 30 },
  { label: 'Sans date', days: null },
]

/** Local calendar date, `YYYY-MM-DD` — the format the field and the backend both read. */
function isoDay(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function FridgeFormScreen(props: FridgeFormMode & { onSuccess?: () => void; prefillBarcode?: string }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()

  const existing = useProductQuery(props.mode === 'edit' ? props.productId : '')
  const lookup = useProductLookupQuery(props.prefillBarcode ?? '')

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState<LocationValue>('fridge')
  const [openfoodfactId, setOpenfoodfactId] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[] | null>(null)
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; amount?: string; expiresAt?: string }>({})
  const [lookupHint, setLookupHint] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [touched, setTouched] = useState(false)

  // Two async sources (the edit-mode product load and a barcode-lookup result)
  // both want to prefill the same fields, and either can resolve first —
  // reachable for real now that the scanner can be launched from an already-open
  // edit form. These two refs make the ordering deterministic instead of "whoever
  // renders last wins": the edit-load prefill applies at most once, and never
  // after a lookup has already applied (a deliberate scan always takes
  // precedence over the product's original data).
  const appliedEditPrefillRef = useRef(false)
  const appliedLookupRef = useRef(false)
  // Tracks which barcode's lookup result has already been applied, so a re-render
  // triggered by something unrelated (e.g. the edit-load query settling) can't
  // reapply the same lookup data a second time.
  const appliedLookupKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (props.mode !== 'edit' || !existing?.data) return
    if (appliedEditPrefillRef.current || appliedLookupRef.current) return
    appliedEditPrefillRef.current = true
    const data = existing.data
    setName(data.name)
    setAmount(String(data.quantity.amount))
    setUnit(data.quantity.unit)
    setCategory(data.category)
    setLocation(data.location)
    setOpenfoodfactId(data.openfoodfactId)
    setCategories(data.categories)
    setExpiresAt(data.expiresAt ? data.expiresAt.slice(0, 10) : '')
  }, [props.mode, existing?.data])

  useEffect(() => {
    if (props.prefillBarcode) lookup.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.prefillBarcode])

  // Split into two flat, mutually-exclusive effects (rather than one effect with an
  // if/else) so each one's setState calls sit directly behind its own ref-guarded
  // early return — see the appliedLookupKeyRef comment above.
  useEffect(() => {
    if (!lookup.isFetched || !lookup.data) return
    const key = props.prefillBarcode ?? ''
    if (appliedLookupKeyRef.current === key) return
    appliedLookupKeyRef.current = key
    appliedLookupRef.current = true
    setName(lookup.data.name)
    setCategory(lookup.data.category ?? '')
    setCategories(lookup.data.categories)
    setOpenfoodfactId(lookup.data.openfoodfactId)
    setLookupHint(null)
  }, [lookup.isFetched, lookup.data, props.prefillBarcode])

  useEffect(() => {
    if (!lookup.isFetched || lookup.data) return
    const key = props.prefillBarcode ?? ''
    if (appliedLookupKeyRef.current === key) return
    appliedLookupKeyRef.current = key
    appliedLookupRef.current = true
    // A real, expected outcome (barcode not in OpenFoodFacts) — not an ApiError, so it
    // gets an informational hint rather than the `error` state used for form validation.
    setLookupHint('Produit non trouvé, remplis les champs à la main.')
  }, [lookup.isFetched, lookup.data, props.prefillBarcode])

  const createProduct = useCreateProductMutation()
  const updateProduct = useUpdateProductMutation()
  const pending = createProduct.isPending || updateProduct.isPending

  /**
   * The lookup already returns OpenFoodFacts' own taxonomy; it used to be
   * fetched, stored, and never offered, leaving the user to invent a
   * category string their flatmate would spell differently.
   */
  const categorySuggestions = useMemo(() => {
    const fromLookup = categories ?? []
    return Array.from(new Set(fromLookup.map((c) => c.trim()).filter((c) => c.length > 0))).slice(0, 4)
  }, [categories])

  const expiryDays = expiresAt.trim().length > 0 ? daysUntilExpiry({ expiresAt: expiresAt.trim() }) : null

  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setTouched(true)
      setter(value)
    }
  }

  function handleBack() {
    if (touched) {
      setConfirmDiscard(true)
      return
    }
    router.back()
  }

  async function handleSubmit() {
    setError(null)
    setFieldErrors({})

    const nextErrors: { name?: string; amount?: string; expiresAt?: string } = {}

    if (name.trim().length === 0) nextErrors.name = 'Le nom est requis.'

    const quantity = Quantity.create(Number(amount), unit)
    if (!quantity.ok) nextErrors.amount = quantity.error.message

    const trimmedExpiresAt = expiresAt.trim()
    if (trimmedExpiresAt.length > 0 && Number.isNaN(new Date(trimmedExpiresAt).getTime())) {
      nextErrors.expiresAt = 'Date invalide (AAAA-MM-JJ).'
    }

    if (Object.keys(nextErrors).length > 0 || !quantity.ok) {
      setFieldErrors(nextErrors)
      return
    }

    const payload = {
      name: name.trim(),
      quantity: quantity.value,
      location,
      category: category.trim().length > 0 ? category.trim() : DEFAULT_CATEGORY,
      openfoodfactId,
      categories,
      expiresAt: trimmedExpiresAt.length > 0 ? new Date(trimmedExpiresAt).toISOString() : null,
    }

    const result =
      props.mode === 'create'
        ? await createProduct.mutateAsync(payload)
        : await updateProduct.mutateAsync({ productId: props.productId, patch: payload })

    if (!result.ok) {
      setError(result.error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['products'] })
    if (props.mode === 'edit') queryClient.invalidateQueries({ queryKey: ['product', props.productId] })

    setTouched(false)
    if (props.onSuccess) {
      props.onSuccess()
      return
    }
    router.back()
  }

  return (
    <>
    <AppShell nav={{ kind: 'stack' }} scrollable={false}>
      <KeyboardAvoidingView style={{ flex: 1, minHeight: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <XStack alignItems="center" gap="$3">
            <BackButton onPress={handleBack} ink={palette.ink} cream={palette.cream} />
            <YStack width={38} height={38} borderRadius={13} backgroundColor={palette.cream} alignItems="center" justifyContent="center">
              <PackageIcon size={19} color={palette.ink} />
            </YStack>
            <Text fontSize={20} fontWeight="800" color={palette.ink} flex={1}>
              {props.mode === 'create' ? 'Ajouter un produit' : 'Modifier le produit'}
            </Text>
          </XStack>

          {/* The product's second principle is "scanne plutôt que saisis".
              This used to be a 13px text line at the bottom of the form. */}
          <ScanAction
            palette={palette}
            onPress={() =>
              router.push(
                props.mode === 'create'
                  ? { pathname: '/(tabs)/fridge/scan', params: { mode: 'create', fromForm: '1' } }
                  : { pathname: '/(tabs)/fridge/scan', params: { mode: 'edit', productId: props.productId, fromForm: '1' } },
              )
            }
          />

          {lookupHint ? (
            <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} marginTop="$2">
              {lookupHint}
            </Text>
          ) : null}

          <YStack marginTop="$4">
            <FormCard palette={palette} gap="$3">
              <FormField
                testID="fridge-form-name"
                label="Nom"
                value={name}
                onChangeText={edit(setName)}
                palette={palette}
                error={fieldErrors.name}
                icon={(color) => <PencilIcon size={13} color={color} />}
              />

              <XStack gap="$2">
                <YStack flex={1}>
                  <FormField
                    testID="fridge-form-amount"
                    label="Quantité"
                    value={amount}
                    onChangeText={edit(setAmount)}
                    palette={palette}
                    keyboardType="number-pad"
                    hint="Nombre entier"
                    error={fieldErrors.amount}
                    icon={(color) => <ScaleIcon size={13} color={color} />}
                  />
                </YStack>
                <YStack flex={1}>
                  <FormField
                    testID="fridge-form-unit"
                    label="Unité"
                    value={unit}
                    onChangeText={edit(setUnit)}
                    palette={palette}
                    autoCapitalize="none"
                  />
                </YStack>
              </XStack>
              <XStack gap="$3" flexWrap="wrap">
                {UNIT_SUGGESTIONS.map((suggestion) => (
                  <Chip
                    key={suggestion}
                    testID={`fridge-form-unit-${suggestion}`}
                    label={suggestion}
                    selected={unit === suggestion}
                    onPress={() => edit(setUnit)(suggestion)}
                    palette={palette}
                    size="dense"
                  />
                ))}
              </XStack>

              <FormField
                testID="fridge-form-category"
                label="Catégorie"
                value={category}
                onChangeText={edit(setCategory)}
                palette={palette}
                hint={`Sert à trier tes produits. Vide = « ${DEFAULT_CATEGORY} ».`}
                icon={(color) => <TagIcon size={13} color={color} />}
              />
              {categorySuggestions.length > 0 ? (
                <XStack gap="$3" flexWrap="wrap">
                  {categorySuggestions.map((suggestion) => (
                    <Chip
                      key={suggestion}
                      testID={`fridge-form-category-${suggestion}`}
                      label={suggestion}
                      selected={category === suggestion}
                      onPress={() => edit(setCategory)(suggestion)}
                      palette={palette}
                    />
                  ))}
                </XStack>
              ) : null}

              <YStack gap="$2">
                <FormField
                  testID="fridge-form-expires-at"
                  label="Date de péremption"
                  value={expiresAt}
                  onChangeText={edit(setExpiresAt)}
                  palette={palette}
                  keyboardType="numbers-and-punctuation"
                  placeholder="AAAA-MM-JJ"
                  hint={expiryDays !== null ? expiryLabel(expiryDays) : undefined}
                  error={fieldErrors.expiresAt}
                  icon={(color) => <CalendarIcon size={13} color={color} />}
                />
                <XStack gap="$3" flexWrap="wrap">
                  {DATE_SHORTCUTS.map((shortcut) => (
                    <Chip
                      key={shortcut.label}
                      testID={`fridge-form-expires-in-${shortcut.days ?? 'none'}`}
                      label={shortcut.days === null ? shortcut.label : `+ ${shortcut.label}`}
                      selected={shortcut.days === null ? expiresAt === '' : expiresAt === isoDay(shortcut.days)}
                      onPress={() => edit(setExpiresAt)(shortcut.days === null ? '' : isoDay(shortcut.days))}
                      palette={palette}
                      size="dense"
                    />
                  ))}
                </XStack>
              </YStack>

              <YStack gap="$1">
                <XStack alignItems="center" gap="$1.5">
                  <ArchiveIcon size={13} color={palette.inkSecondary} />
                  <Text fontSize={12} fontWeight="700" color={palette.ink}>
                    Emplacement
                  </Text>
                </XStack>
                <XStack gap="$3" flexWrap="wrap">
                  {LOCATIONS.map((loc) => (
                    <Chip
                      key={loc}
                      testID={`fridge-form-location-${loc}`}
                      label={LOCATION_LABELS[loc]}
                      selected={location === loc}
                      onPress={() => edit(setLocation)(loc)}
                      palette={palette}
                      icon={LOCATION_ICONS[loc]}
                    />
                  ))}
                </XStack>
              </YStack>

              {error ? (
                <Text fontSize={13} fontWeight="600" color={palette.expiredText} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}

              <AuthButton testID="fridge-form-submit" label="Enregistrer" pendingLabel="Enregistrement..." pending={pending} onPress={handleSubmit} />
            </FormCard>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppShell>
    <ActionSheet
      visible={confirmDiscard}
      onClose={() => setConfirmDiscard(false)}
      title="Abandonner les modifications ?"
      description="Ce que tu as saisi ne sera pas enregistré."
      options={[
        {
          testID: 'fridge-form-discard',
          label: 'Abandonner',
          icon: (color) => <XIcon size={18} color={color} />,
          tint: palette.expired,
          destructive: true,
          onPress: () => {
            setConfirmDiscard(false)
            router.back()
          },
        },
      ]}
    />
    </>
  )
}

function ScanAction({ palette, onPress }: { palette: SoftPalette; onPress: () => void }) {
  const hover = useHoverPress()
  return (
    <Pressable
      testID="fridge-form-scan"
      onPress={onPress}
      onHoverIn={hover.onHoverIn}
      onHoverOut={hover.onHoverOut}
      onPressIn={hover.onPressIn}
      onPressOut={hover.onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Scanner un code-barres"
      style={pointerCursor}
    >
      <Animated.View style={{ transform: [{ scale: hover.scale }], marginTop: 20 }}>
        <XStack
          alignItems="center"
          gap="$3"
          minHeight={56}
          paddingHorizontal="$4"
          backgroundColor={palette.accentLime}
          style={{
            borderTopLeftRadius: 24,
            borderTopRightRadius: 14,
            borderBottomRightRadius: 24,
            borderBottomLeftRadius: 14,
          }}
        >
          <ScanLineIcon size={20} color={palette.accentLimeText} />
          <YStack flex={1}>
            <Text fontSize={14} fontWeight="800" color={palette.accentLimeText}>
              Scanner le code-barres
            </Text>
            <Text fontSize={12} fontWeight="500" color={palette.accentLimeText} opacity={0.8}>
              Remplit le nom et la catégorie pour toi.
            </Text>
          </YStack>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
