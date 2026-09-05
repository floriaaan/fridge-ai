import { Pressable } from 'react-native'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { AppShell } from '../shared/app-shell.js'
import { BackButton } from '../shared/back-button.js'
import { goBack } from '../shared/navigation.js'
import { pointerCursor } from '../shared/hover.js'
import { ChevronRightIcon } from '../dashboard/dashboard-icons.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useReceiptQuery } from '../../application/receipt/receipt.query.js'

export function ReceiptDetailScreen({ receiptId }: { receiptId: string }) {
  const palette = useSoftPalette()
  const query = useReceiptQuery(receiptId)

  const header = (
    <XStack alignItems="center" gap="$3">
      <BackButton onPress={() => goBack('/(tabs)/receipts')} ink={palette.ink} cream={palette.cream} />
      <Text fontSize={20} fontWeight="800" color={palette.ink}>
        Ticket
      </Text>
    </XStack>
  )

  // Was `return null`: a blank white screen with no chrome, no back button
  // and nothing for a screen reader to announce, for the whole load.
  if (query.isPending) {
    return (
      <AppShell nav={{ kind: 'stack' }}>
        {header}
        <YStack marginTop="$8" alignItems="center">
          <Text fontSize={14} fontWeight="500" color={palette.inkSecondary}>
            Chargement du ticket…
          </Text>
        </YStack>
      </AppShell>
    )
  }

  if (!query.data) {
    return (
      <AppShell nav={{ kind: 'stack' }}>
        {header}
        <YStack alignItems="center" justifyContent="center" marginTop="$8">
          <Text fontSize={14} color={palette.ink}>
            Ticket introuvable.
          </Text>
        </YStack>
      </AppShell>
    )
  }

  const { receipt, products } = query.data

  return (
    <AppShell nav={{ kind: 'stack' }}>
      <XStack alignItems="center" gap="$3">
        <BackButton onPress={() => goBack('/(tabs)/receipts')} ink={palette.ink} cream={palette.cream} />
        <YStack>
          <Text fontSize={20} fontWeight="800" color={palette.ink}>
            {receipt.storeName}
          </Text>
          <Text fontSize={13} color={palette.inkSecondary} marginTop="$0.5">
            {receipt.scannedAt.slice(0, 10)} · {receipt.totalAmount.toFixed(2)} €
          </Text>
        </YStack>
      </XStack>

      <YStack marginTop="$5" gap="$2">
        <Text fontSize={13} fontWeight="700" color={palette.inkSecondary}>
          {products.length} produit{products.length > 1 ? 's' : ''} importé{products.length > 1 ? 's' : ''}
        </Text>
        {/* These rows used to be inert: the ticket listed the products it
            created with no route back to any of them. */}
        {products.map((product) => (
          <Pressable
            key={product.id}
            testID={`receipt-product-${product.id}`}
            onPress={() => router.push({ pathname: '/(tabs)/fridge/[id]', params: { id: product.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${product.name}, ${product.quantity.amount} ${product.quantity.unit}`}
            style={pointerCursor}
          >
            <XStack backgroundColor={palette.mintPale} borderRadius={16} padding="$3" minHeight={52} alignItems="center" gap="$3">
              <Text fontSize={14} fontWeight="700" color={palette.mintPaleText} flex={1}>
                {product.name}
              </Text>
              <Text fontSize={13} color={palette.mintPaleText}>
                {product.quantity.amount} {product.quantity.unit}
              </Text>
              <ChevronRightIcon size={16} color={palette.mintPaleText} />
            </XStack>
          </Pressable>
        ))}
      </YStack>
    </AppShell>
  )
}
