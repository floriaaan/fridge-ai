import { Button } from 'tamagui'
import { YStack } from '../shared/tamagui-typed.js'
import { useAuthMethodsQuery } from '../../application/identity/auth-methods.query.js'
import { useSignInSocialMutation } from '../../application/identity/sign-in.mutation.js'
import { ErrorState } from '../shared/error-state.js'

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
    <YStack padding="$4">
      {error ? <ErrorState message={error} /> : null}
      <Button onPress={handlePress} disabled={signInSocial.isPending} testID="signin-social-pocketid">
        {pocketId.label}
      </Button>
    </YStack>
  )
}
