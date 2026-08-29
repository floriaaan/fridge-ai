import { useState } from 'react'
import { Animated, Pressable } from 'react-native'
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { Text, XStack, YStack } from '../shared/tamagui-typed.js'
import { pointerCursor } from '../shared/hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { HandDrawnCheck } from './hand-drawn-check.js'
import { CheckedName } from './checked-name.js'
import { useQuietRowFeedback } from './use-quiet-row-feedback.js'
import type { ShoppingItem } from '../../domain/shopping-list/shopping-item.js'

export function ShoppingRow({
  item,
  onToggle,
  onEdit,
  onDelete,
  isLast,
}: {
  item: ShoppingItem
  onToggle: (checked: boolean) => void
  onEdit: () => void
  onDelete: () => void
  isLast: boolean
}) {
  const palette = useSoftPalette()
  const row = useQuietRowFeedback()
  // Tracks the swipe's actual open/closed state so the "Modifier"/"Supprimer"
  // actions can be pulled out of the accessibility tree while closed — they're
  // always mounted (just visually clipped/transformed off-screen) so a screen
  // reader could otherwise reach "Supprimer" without the swipe gesture that's
  // meant to be the intent-confirmation step (spec §3).
  const [isOpen, setIsOpen] = useState(false)
  return (
    <Swipeable
      onSwipeableOpen={() => setIsOpen(true)}
      onSwipeableClose={() => setIsOpen(false)}
      renderRightActions={(_progress, _translation, swipeableMethods) => (
        <XStack accessibilityElementsHidden={!isOpen} importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}>
          <Pressable
            testID={`shopping-row-edit-${item.id}`}
            onPress={() => {
              swipeableMethods.close()
              onEdit()
            }}
            accessibilityRole="button"
            accessibilityLabel={`Modifier ${item.name}`}
            style={pointerCursor}
          >
            <YStack backgroundColor={palette.mintPale} alignItems="center" justifyContent="center" width={72} height="100%">
              <Text fontSize={12} fontWeight="700" color={palette.mintPaleText}>
                Modifier
              </Text>
            </YStack>
          </Pressable>
          <Pressable
            testID={`shopping-row-delete-${item.id}`}
            onPress={() => {
              swipeableMethods.close()
              onDelete()
            }}
            accessibilityRole="button"
            accessibilityLabel={`Supprimer ${item.name}`}
            style={pointerCursor}
          >
            <YStack backgroundColor={palette.expiredBg} alignItems="center" justifyContent="center" width={72} height="100%">
              <Text fontSize={12} fontWeight="700" color={palette.expiredText}>
                Supprimer
              </Text>
            </YStack>
          </Pressable>
        </XStack>
      )}
    >
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
    </Swipeable>
  )
}
