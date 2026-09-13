import { Link, router } from 'expo-router'
import { Pressable } from 'react-native'
import { Text, YStack } from '../../presentation/shared/tamagui-typed.js'
import { LoginForm } from '../../presentation/identity/login-form.js'
import { AuthMethodFooter } from '../../presentation/identity/auth-method-footer.js'
import { AuthShell } from '../../presentation/identity/auth-shell.js'
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
    <AuthShell title="Content de te revoir" subtitle="Connecte-toi pour voir ce qu'il y a dans ton garde-manger.">
      <AuthMethodFooter
        emailLabel="Continuer avec e-mail"
        emailForm={<LoginForm onSuccess={handleSuccess} />}
        onSuccess={handleSuccess}
      />
      <Link href="/(auth)/sign-up" asChild>
        <Pressable style={pointerCursor}>
          <YStack alignItems="center" paddingTop="$1">
            <Text fontSize={13} fontWeight="600" color={palette.onDarkSecondary}>
              {"Pas de compte ? "}
              <Text fontSize={13} fontWeight="800" color={palette.onDark}>
                {"S'inscrire"}
              </Text>
            </Text>
          </YStack>
        </Pressable>
      </Link>
    </AuthShell>
  )
}
