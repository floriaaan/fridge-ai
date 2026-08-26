import { router } from 'expo-router'
import { Button } from 'tamagui'
import { Text, YStack } from '../../presentation/shared/tamagui-typed.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { useSignOutMutation } from '../../application/identity/sign-out.mutation.js'
import { ErrorState } from '../../presentation/shared/error-state.js'

export default function HomeScreen() {
  const session = useSessionQuery()
  const signOut = useSignOutMutation()

  async function handleSignOut() {
    try {
      await signOut.mutateAsync(undefined)
    } catch {
      return
    }
    await session.refetch()
    router.replace('/(auth)/sign-in')
  }

  const error = signOut.error ? 'Une erreur est survenue lors de la déconnexion.' : null

  return (
    <YStack flex={1} justifyContent="center" alignItems="center" gap="$4">
      <Text>Connecté en tant que {session.data?.user.name}</Text>
      {error ? <ErrorState message={error} /> : null}
      <Button onPress={handleSignOut} testID="sign-out">
        Se déconnecter
      </Button>
    </YStack>
  )
}
