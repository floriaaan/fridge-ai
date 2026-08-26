import { Text, YStack } from './tamagui-typed.js'

export function ErrorState({ message }: { message: string }) {
  return (
    <YStack padding="$4" alignItems="center">
      <Text color="$red10">{message}</Text>
    </YStack>
  )
}
