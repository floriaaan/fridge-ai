import { Animated, Pressable } from 'react-native'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { HandDrawnCheck } from './hand-drawn-check.js'
import { CheckedName } from './checked-name.js'
import { useQuietRowFeedback } from './use-quiet-row-feedback.js'
import type { ShoppingItem } from '../../domain/shopping-list/shopping-item.js'

export function ShoppingRow({ item, onToggle, isLast }: { item: ShoppingItem; onToggle: (checked: boolean) => void; isLast: boolean }) {
  const palette = useSoftPalette()
  const row = useQuietRowFeedback()
  return (
    <Pressable
      onPress={() => onToggle(!item.checked)}
      onHoverIn={row.onHoverIn}
      onHoverOut={row.onHoverOut}
      onPressIn={row.pressIn}
      onPressOut={row.pressOut}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      accessibilityLabel={`${item.name}, ${item.quantity.amount} ${item.quantity.unit}`}
      style={pointerCursor}
    >
      <Animated.View
        style={{
          opacity: row.opacity,
          backgroundColor: row.hovered ? palette.layoutSurface : 'transparent',
          borderRadius: 10,
        }}
      >
        <XStack
          alignItems="center"
          gap="$3"
          paddingVertical="$2.5"
          paddingHorizontal="$2"
          minHeight={48}
          style={!isLast ? { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: palette.paperRule } : undefined}
        >
          <YStack
            width={24}
            height={24}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor={item.checked ? palette.freshBg : 'transparent'}
            style={{ borderWidth: item.checked ? 0 : 2.5, borderColor: palette.inkSecondary }}
          >
            {item.checked ? <HandDrawnCheck size={15} color={palette.freshText} /> : null}
          </YStack>
          <YStack flex={1}>
            {item.checked ? (
              <CheckedName color={palette.penMark}>{item.name}</CheckedName>
            ) : (
              <Text fontSize={14} fontWeight="700" color={palette.ink}>
                {item.name}
              </Text>
            )}
            <Text fontSize={12} fontWeight="500" color={palette.inkSecondary} marginTop="$0.5">
              {item.quantity.amount} {item.quantity.unit}
            </Text>
          </YStack>
        </XStack>
      </Animated.View>
    </Pressable>
  )
}
