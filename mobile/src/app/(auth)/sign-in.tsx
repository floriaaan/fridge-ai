import { Link, router } from 'expo-router'
import { Text, YStack } from '../../presentation/shared/tamagui-typed.js'
import { LoginForm } from '../../presentation/identity/login-form.js'
import { AuthMethodButtons } from '../../presentation/identity/auth-method-buttons.js'

export default function SignInScreen() {
  function handleSuccess() {
    router.replace('/(tabs)')
  }

  return (
    <YStack flex={1} justifyContent="center">
      <LoginForm onSuccess={handleSuccess} />
      <AuthMethodButtons onSuccess={handleSuccess} />
      <Link href="/(auth)/sign-up">
        <Text textAlign="center" padding="$4">
          {"Pas de compte ? S'inscrire"}
        </Text>
      </Link>
    </YStack>
  )
}
