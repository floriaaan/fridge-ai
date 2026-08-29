import { TextInput } from 'react-native'
import { Text, YStack } from '../shared/tamagui-typed.js'

export function FormField({
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
