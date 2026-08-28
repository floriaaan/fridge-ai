import { Link, router } from 'expo-router'
import { Pressable } from 'react-native'
import { Text, YStack } from '../../presentation/shared/tamagui-typed.js'
import { LoginForm } from '../../presentation/identity/login-form.js'
import { AuthMethodButtons } from '../../presentation/identity/auth-method-buttons.js'
import { AuthShell } from '../../presentation/identity/auth-ui.js'
import { useSessionQuery } from '../../application/identity/session.query.js'
import { pointerCursor } from '../../presentation/shared/hover.js'
import { useSoftPalette } from '../../presentation/dashboard/soft-palette.js'

export default function SignInScreen() {
  const session = useSessionQuery()
  const palette = useSoftPalette()

  async function handleSuccess() {
    await session.refetch()
    router.replace('/(tabs)')
  }

  return (
    <AuthShell title="Content de te revoir" subtitle="Connecte-toi pour voir ce qu'il y a dans ton frigo.">
      <LoginForm onSuccess={handleSuccess} />
      <AuthMethodButtons onSuccess={handleSuccess} />
      <Link href="/(auth)/sign-up" asChild>
        <Pressable style={pointerCursor}>
          <YStack alignItems="center" paddingTop="$1">
            <Text fontSize={13} fontWeight="600" color={palette.inkSecondary}>
              {"Pas de compte ? "}
              <Text fontSize={13} fontWeight="800" color={palette.ink}>
                {"S'inscrire"}
              </Text>
            </Text>
          </YStack>
        </Pressable>
      </Link>
    </AuthShell>
  )
}
