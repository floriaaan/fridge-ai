import { Link, router } from 'expo-router'
import { Pressable } from 'react-native'
import { Text, YStack } from '../../presentation/shared/tamagui-typed.js'
import { SignupForm } from '../../presentation/identity/signup-form.js'
import { AuthMethodButtons } from '../../presentation/identity/auth-method-buttons.js'
import { AuthShell } from '../../presentation/identity/auth-ui.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { pointerCursor } from '../../presentation/shared/hover.js'
import { useSoftPalette } from '../../presentation/dashboard/soft-palette.js'

export default function SignUpScreen() {
  const session = useSessionQuery()
  const palette = useSoftPalette()

  async function handleSuccess() {
    await session.refetch()
    router.replace('/(tabs)')
  }

  return (
    <AuthShell title="Crée ton compte" subtitle="Un foyer partagé, un frigo à jour pour tout le monde.">
      <SignupForm onSuccess={handleSuccess} />
      <AuthMethodButtons onSuccess={handleSuccess} />
      <Link href="/(auth)/sign-in" asChild>
        <Pressable style={pointerCursor}>
          <YStack alignItems="center" paddingTop="$1">
            <Text fontSize={13} fontWeight="600" color={palette.inkSecondary}>
              {'Déjà un compte ? '}
              <Text fontSize={13} fontWeight="800" color={palette.ink}>
                Se connecter
              </Text>
            </Text>
          </YStack>
        </Pressable>
      </Link>
    </AuthShell>
  )
}
