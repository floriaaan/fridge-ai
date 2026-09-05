import { FlatList, Pressable } from 'react-native'
import { router } from 'expo-router'
import { XStack, YStack, Text } from '../shared/tamagui-typed.js'
import { AppShell, shellContentStyle, useAppShellLayout } from '../shared/app-shell.js'
import { BackButton } from '../shared/back-button.js'
import { goBack } from '../shared/navigation.js'
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

// Same pushed-screen convention as settings-screen.tsx: `{ kind: 'stack' }`
// AppShell nav — BackButton in the header, full shell everywhere else. An
// audit found this screen previously had no shell at all.
export function ReceiptsListScreen() {
  const palette = useSoftPalette()
  const receipts = useReceiptsQuery()
  const nav = { kind: 'stack' as const }
  const { isWide, hasMobileNav } = useAppShellLayout(nav)

  return (
    <AppShell nav={nav} scrollable={false}>
      <FlatList
        data={receipts.data ?? []}
        keyExtractor={(receipt) => receipt.id}
        renderItem={({ item }) => <ReceiptRow receipt={item} palette={palette} />}
        contentContainerStyle={shellContentStyle({ isWide, hasMobileNav })}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <XStack alignItems="center" gap="$3" marginBottom="$4">
            <BackButton onPress={() => goBack('/(tabs)/settings')} ink={palette.ink} cream={palette.cream} />
            <Text fontSize={20} fontWeight="800" color={palette.ink}>
              Historique des tickets
            </Text>
          </XStack>
        }
        ListEmptyComponent={
          receipts.data?.length === 0 ? (
            <Text fontSize={13} color={palette.inkSecondary}>
              Aucun ticket importé pour l&apos;instant.
            </Text>
          ) : null
        }
      />
    </AppShell>
  )
}
