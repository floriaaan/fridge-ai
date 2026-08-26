import { router } from 'expo-router'
import { YStack } from '../../presentation/shared/tamagui-typed.js'
import { SignupForm } from '../../presentation/identity/signup-form.js'

export default function SignUpScreen() {
  function handleSuccess() {
    router.replace('/(tabs)')
  }

  return (
    <YStack flex={1} justifyContent="center">
      <SignupForm onSuccess={handleSuccess} />
    </YStack>
  )
}
