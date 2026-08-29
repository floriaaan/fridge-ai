import { Modal, Pressable } from 'react-native'
import { Text, YStack } from './tamagui-typed.js'
import { pointerCursor } from './hover.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'

export interface ActionSheetOption {
  testID: string
  label: string
  onPress: () => void
}

/**
 * A minimal two-to-a-few-option bottom sheet — no new library (the app has
 * no other action-sheet usage to justify one, and this keeps behavior
 * identical across web/iOS/Android instead of reaching for the
 * iOS-only `ActionSheetIOS`). Renders nothing at all when `visible` is
 * false, rather than relying on RN `Modal`'s own `visible` prop, so tests
 * don't depend on how the test renderer mocks `Modal`.
 */
export function ActionSheet({
  visible,
  onClose,
  options,
}: {
  visible: boolean
  onClose: () => void
  options: ActionSheetOption[]
}) {
  const palette = useSoftPalette()
  if (!visible) return null

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        testID="action-sheet-backdrop"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
      >
        <YStack backgroundColor={palette.layoutSurface} borderTopLeftRadius={24} borderTopRightRadius={24} padding="$4" gap="$1">
          {options.map((option) => (
            <Pressable
              key={option.testID}
              testID={option.testID}
              onPress={option.onPress}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              style={pointerCursor}
            >
              <YStack paddingVertical="$3" paddingHorizontal="$2">
                <Text fontSize={15} fontWeight="700" color={palette.ink}>
                  {option.label}
                </Text>
              </YStack>
            </Pressable>
          ))}
        </YStack>
      </Pressable>
    </Modal>
  )
}
