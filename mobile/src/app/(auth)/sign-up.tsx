import { router } from 'expo-router'
import { YStack } from '../../presentation/shared/tamagui-typed.js'
import { SignupForm } from '../../presentation/identity/signup-form.js'
import { useSessionQuery } from '../../application/identity/session.query.js'

export default function SignUpScreen() {
  const session = useSessionQuery()

  async function handleSuccess() {
    await session.refetch()
    router.replace('/(tabs)')
  }

  return (
    <YStack flex={1} justifyContent="center">
      <SignupForm onSuccess={handleSuccess} />
    </YStack>
  )
}
