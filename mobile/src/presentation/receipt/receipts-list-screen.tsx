import { Pressable, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useReceiptsQuery } from '../../application/receipt/receipts.query.js'
import type { Receipt } from '../../domain/receipt/receipt.js'

function ReceiptRow({ receipt, palette }: { receipt: Receipt; palette: ReturnType<typeof useSoftPalette> }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(tabs)/receipts/[id]', params: { id: receipt.id } })}
      accessibilityRole="button"
      accessibilityLabel={receipt.storeName}
      style={pointerCursor}
    >
      <XStack backgroundColor={palette.gradientBottom} borderRadius={16} padding="$3" marginBottom="$2" justifyContent="space-between">
        <YStack>
          <Text fontSize={14} fontWeight="700" color={palette.ink}>
            {receipt.storeName}
          </Text>
          <Text fontSize={12} color={palette.inkSecondary}>
            {receipt.scannedAt.slice(0, 10)} · {receipt.itemsCount} article{receipt.itemsCount > 1 ? 's' : ''}
          </Text>
        </YStack>
        <Text fontSize={14} fontWeight="700" color={palette.ink}>
          {receipt.totalAmount.toFixed(2)} €
        </Text>
      </XStack>
    </Pressable>
  )
}

export function ReceiptsListScreen() {
  const palette = useSoftPalette()
  const receipts = useReceiptsQuery()

  return (
    <YStack flex={1} backgroundColor={palette.gradientBottom}>
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} padding="$4">
          <Text fontSize={20} fontWeight="800" color={palette.ink} marginBottom="$3">
            Historique des tickets
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {receipts.data?.length === 0 ? (
              <Text fontSize={13} color={palette.inkSecondary}>
                Aucun ticket importé pour l&apos;instant.
              </Text>
            ) : null}
            {receipts.data?.map((receipt) => (
              <ReceiptRow key={receipt.id} receipt={receipt} palette={palette} />
            ))}
          </ScrollView>
        </YStack>
      </SafeAreaView>
    </YStack>
  )
}
