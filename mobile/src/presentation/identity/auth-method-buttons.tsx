import { YStack } from '../shared/tamagui-typed.js'
import { useAuthMethodsQuery } from '../../application/identity/auth-methods.query.js'
import { useSignInSocialMutation } from '../../application/identity/sign-in.mutation.js'
import { AuthButton, AuthDivider, AuthError } from './auth-ui.js'
import { PocketIdIcon } from './pocket-id-icon.js'

export function AuthMethodButtons({ onSuccess }: { onSuccess: () => void }) {
  const authMethods = useAuthMethodsQuery()
  const signInSocial = useSignInSocialMutation()

  const pocketId = authMethods.data?.find((m) => m.id === 'pocketid' && m.enabled)

  const error = signInSocial.error
    ? 'Une erreur est survenue lors de la connexion.'
    : signInSocial.data && !signInSocial.data.ok
      ? signInSocial.data.error.message
      : null

  if (!pocketId) return null

  async function handlePress() {
    const result = await signInSocial.mutateAsync({ provider: 'pocketid' })
    if (result.ok) onSuccess()
  }

  return (
    <YStack gap="$3">
      <AuthDivider label="ou" />
      {error ? <AuthError message={error} /> : null}
      <AuthButton
        label={pocketId.label}
        pendingLabel="Connexion..."
        pending={signInSocial.isPending}
        onPress={handlePress}
        variant="secondary"
        icon={<PocketIdIcon size={18} />}
        testID="signin-social-pocketid"
      />
    </YStack>
  )
}
