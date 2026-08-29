import { useEffect, useRef, useState } from 'react'
import { Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
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
  const [lookupHint, setLookupHint] = useState<string | null>(null)

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

  async function handleSubmit() {
    setError(null)
    const quantity = Quantity.create(Number(amount), unit)
    if (!quantity.ok) {
      setError(quantity.error.message)
      return
    }
    if (name.trim().length === 0) {
      setError('Le nom est requis.')
      return
    }
    if (category.trim().length === 0) {
      setError('La catégorie est requise.')
      return
    }

    const trimmedExpiresAt = expiresAt.trim()
    const payload = {
      name: name.trim(),
      quantity: quantity.value,
      location,
      category: category.trim(),
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
          {props.mode === 'create' ? 'Ajouter un produit' : 'Modifier le produit'}
        </Text>

        <FormField testID="fridge-form-name" label="Nom" value={name} onChangeText={setName} color={palette.ink} />
        <FormField testID="fridge-form-amount" label="Quantité" value={amount} onChangeText={setAmount} color={palette.ink} />
        <FormField testID="fridge-form-unit" label="Unité" value={unit} onChangeText={setUnit} color={palette.ink} />
        <FormField testID="fridge-form-category" label="Catégorie" value={category} onChangeText={setCategory} color={palette.ink} />
        <FormField
          testID="fridge-form-expires-at"
          label="Date de péremption (AAAA-MM-JJ)"
          value={expiresAt}
          onChangeText={setExpiresAt}
          color={palette.ink}
        />

        <YStack gap="$1">
          <Text fontSize={12} fontWeight="700" color={palette.ink}>
            Emplacement
          </Text>
          <YStack flexDirection="row" gap="$2">
            {LOCATIONS.map((loc) => (
              <Pressable
                key={loc}
                testID={`fridge-form-location-${loc}`}
                onPress={() => setLocation(loc)}
                accessibilityRole="button"
                accessibilityState={{ selected: location === loc }}
                style={pointerCursor}
              >
                <YStack
                  backgroundColor={location === loc ? palette.accentLime : palette.mintPale}
                  borderRadius={999}
                  paddingVertical="$1.5"
                  paddingHorizontal="$3"
                >
                  <Text fontSize={12} fontWeight="700" color={location === loc ? palette.accentLimeText : palette.mintPaleText}>
                    {LOCATION_LABELS[loc]}
                  </Text>
                </YStack>
              </Pressable>
            ))}
          </YStack>
        </YStack>

        <Pressable
          testID="fridge-form-scan"
          onPress={() =>
            router.push(
              props.mode === 'create'
                ? { pathname: '/(tabs)/fridge/scan', params: { mode: 'create', fromForm: '1' } }
                : { pathname: '/(tabs)/fridge/scan', params: { mode: 'edit', productId: props.productId, fromForm: '1' } },
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Scanner un code-barres"
          style={pointerCursor}
        >
          <Text fontSize={13} fontWeight="700" color={palette.mintPaleText}>
            Scanner un code-barres
          </Text>
        </Pressable>

        {lookupHint ? (
          <Text fontSize={12} color={palette.inkSecondary}>
            {lookupHint}
          </Text>
        ) : null}

        {error ? (
          <Text fontSize={13} color={palette.expiredText}>
            {error}
          </Text>
        ) : null}

        <Pressable
          testID="fridge-form-submit"
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
