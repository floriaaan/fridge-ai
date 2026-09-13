import { Link, router } from 'expo-router'
import { Pressable } from 'react-native'
import { Text, YStack } from '../../presentation/shared/tamagui-typed.js'
import { SignupForm } from '../../presentation/identity/signup-form.js'
import { AuthMethodFooter } from '../../presentation/identity/auth-method-footer.js'
import { AuthShell } from '../../presentation/identity/auth-shell.js'
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
    <AuthShell title="Crée ton compte" subtitle="Un foyer partagé, un garde-manger à jour pour tout le monde.">
      <AuthMethodFooter
        emailLabel="Créer un compte avec e-mail"
        emailForm={<SignupForm onSuccess={handleSuccess} />}
        onSuccess={handleSuccess}
      />
      <Link href="/(auth)/sign-in" asChild>
        <Pressable style={pointerCursor}>
          <YStack alignItems="center" paddingTop="$1">
            <Text fontSize={13} fontWeight="600" color={palette.onDarkSecondary}>
              {'Déjà un compte ? '}
              <Text fontSize={13} fontWeight="800" color={palette.onDark}>
                Se connecter
              </Text>
            </Text>
          </YStack>
        </Pressable>
      </Link>
    </AuthShell>
  )
}
