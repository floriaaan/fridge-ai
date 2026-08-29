import { ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useReceiptQuery } from '../../application/receipt/receipt.query.js'

export function ReceiptDetailScreen({ receiptId }: { receiptId: string }) {
  const palette = useSoftPalette()
  const query = useReceiptQuery(receiptId)

  if (query.isPending) return null

  if (!query.data) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Text fontSize={14} color={palette.ink}>
            Ticket introuvable.
          </Text>
        </YStack>
      </SafeAreaView>
    )
  }

  const { receipt, products } = query.data

  return (
    <YStack flex={1} backgroundColor={palette.gradientBottom}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text fontSize={20} fontWeight="800" color={palette.ink}>
            {receipt.storeName}
          </Text>
          <Text fontSize={13} color={palette.inkSecondary} marginTop="$1">
            {receipt.scannedAt.slice(0, 10)} · {receipt.totalAmount.toFixed(2)} €
          </Text>

          <YStack marginTop="$4" gap="$2">
            {products.map((product) => (
              <XStack key={product.id} backgroundColor={palette.mintPale} borderRadius={16} padding="$3" justifyContent="space-between">
                <Text fontSize={14} fontWeight="700" color={palette.mintPaleText}>
                  {product.name}
                </Text>
                <Text fontSize={13} color={palette.mintPaleText}>
                  {product.quantity.amount} {product.quantity.unit}
                </Text>
              </XStack>
            ))}
          </YStack>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  )
}
