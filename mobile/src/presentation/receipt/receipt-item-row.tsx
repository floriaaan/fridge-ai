import { Pressable } from 'react-native'
import { Text, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { FormField } from '../fridge/form-field.js'
import { LOCATIONS } from '../../domain/fridge/location.js'
import type { LocationValue } from '../../domain/fridge/location.js'

/**
 * String fields for every text input (same convention `fridge-form-screen.tsx`
 * uses for `amount`/`expiresAt`) — parsed/validated once, at submit time, in
 * `receipt-review-screen.tsx`, not on every keystroke here.
 */
export interface EditableReceiptItem {
  name: string
  quantity: string
  unit: string
  category: string
  price: string
  location: LocationValue
  expiresAt: string
}

const LOCATION_LABELS: Record<LocationValue, string> = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' }

export function ReceiptItemRow({
  index,
  item,
  onChange,
}: {
  index: number
  item: EditableReceiptItem
  onChange: (item: EditableReceiptItem) => void
}) {
  const palette = useSoftPalette()

  function set<K extends keyof EditableReceiptItem>(key: K, value: EditableReceiptItem[K]) {
    onChange({ ...item, [key]: value })
  }

  return (
    <YStack backgroundColor={palette.gradientBottom} borderRadius={16} padding="$3" gap="$2" marginBottom="$2">
      <FormField testID={`receipt-item-${index}-name`} label="Nom" value={item.name} onChangeText={(v) => set('name', v)} color={palette.ink} />
      <FormField testID={`receipt-item-${index}-quantity`} label="Quantité" value={item.quantity} onChangeText={(v) => set('quantity', v)} color={palette.ink} />
      <FormField testID={`receipt-item-${index}-unit`} label="Unité" value={item.unit} onChangeText={(v) => set('unit', v)} color={palette.ink} />
      <FormField testID={`receipt-item-${index}-category`} label="Catégorie" value={item.category} onChangeText={(v) => set('category', v)} color={palette.ink} />
      <FormField testID={`receipt-item-${index}-price`} label="Prix" value={item.price} onChangeText={(v) => set('price', v)} color={palette.ink} />
      <FormField
        testID={`receipt-item-${index}-expires-at`}
        label="Date de péremption (AAAA-MM-JJ)"
        value={item.expiresAt}
        onChangeText={(v) => set('expiresAt', v)}
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
              testID={`receipt-item-${index}-location-${loc}`}
              onPress={() => set('location', loc)}
              accessibilityRole="button"
              accessibilityState={{ selected: item.location === loc }}
              style={pointerCursor}
            >
              <YStack
                backgroundColor={item.location === loc ? palette.accentLime : palette.mintPale}
                borderRadius={999}
                paddingVertical="$1.5"
                paddingHorizontal="$3"
              >
                <Text fontSize={12} fontWeight="700" color={item.location === loc ? palette.accentLimeText : palette.mintPaleText}>
                  {LOCATION_LABELS[loc]}
                </Text>
              </YStack>
            </Pressable>
          ))}
        </YStack>
      </YStack>
    </YStack>
  )
}
