import { useEffect, useState } from 'react'
import { Pressable, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useProductQuery } from '../../application/fridge/product.query.js'
import { useProductLookupQuery } from '../../application/fridge/product-lookup.query.js'
import { useCreateProductMutation } from '../../application/fridge/create-product.mutation.js'
import { useUpdateProductMutation } from '../../application/fridge/update-product.mutation.js'
import { Quantity } from '../../domain/fridge/quantity.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'

type FridgeFormMode = { mode: 'create' } | { mode: 'edit'; productId: string }

const LOCATION_LABELS: Record<LocationValue, string> = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' }

function Field({
  testID,
  label,
  value,
  onChangeText,
  color,
}: {
  testID: string
  label: string
  value: string
  onChangeText: (text: string) => void
  color: string
}) {
  return (
    <YStack gap="$1">
      <Text fontSize={12} fontWeight="700" color={color}>
        {label}
      </Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: 10, fontSize: 15 }}
      />
    </YStack>
  )
}

export function FridgeFormScreen(props: FridgeFormMode & { onSuccess?: () => void; prefillBarcode?: string }) {
  const palette = useSoftPalette()
  const queryClient = useQueryClient()

  const existing = props.mode === 'edit' ? useProductQuery(props.productId) : null
  const lookup = useProductLookupQuery(props.prefillBarcode ?? '')

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState<LocationValue>('fridge')
  const [openfoodfactId, setOpenfoodfactId] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lookupHint, setLookupHint] = useState<string | null>(null)

  useEffect(() => {
    if (props.mode === 'edit' && existing?.data) {
      setName(existing.data.name)
      setAmount(String(existing.data.quantity.amount))
      setUnit(existing.data.quantity.unit)
      setCategory(existing.data.category)
      setLocation(existing.data.location)
      setOpenfoodfactId(existing.data.openfoodfactId)
      setCategories(existing.data.categories)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.data])

  useEffect(() => {
    if (props.prefillBarcode) lookup.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.prefillBarcode])

  useEffect(() => {
    if (!lookup.isFetched) return
    if (lookup.data) {
      setName(lookup.data.name)
      setCategory(lookup.data.category ?? '')
      setCategories(lookup.data.categories)
      setOpenfoodfactId(lookup.data.openfoodfactId)
      setLookupHint(null)
    } else {
      // A real, expected outcome (barcode not in OpenFoodFacts) — not an ApiError, so it
      // gets an informational hint rather than the `error` state used for form validation.
      setLookupHint('Produit non trouvé, remplis les champs à la main.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup.isFetched, lookup.data])

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

    const payload = { name: name.trim(), quantity: quantity.value, location, category: category.trim(), openfoodfactId, categories }

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

        <Field testID="fridge-form-name" label="Nom" value={name} onChangeText={setName} color={palette.ink} />
        <Field testID="fridge-form-amount" label="Quantité" value={amount} onChangeText={setAmount} color={palette.ink} />
        <Field testID="fridge-form-unit" label="Unité" value={unit} onChangeText={setUnit} color={palette.ink} />
        <Field testID="fridge-form-category" label="Catégorie" value={category} onChangeText={setCategory} color={palette.ink} />

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
                ? { pathname: '/(tabs)/fridge/scan', params: { mode: 'create' } }
                : { pathname: '/(tabs)/fridge/scan', params: { mode: 'edit', productId: props.productId } },
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
