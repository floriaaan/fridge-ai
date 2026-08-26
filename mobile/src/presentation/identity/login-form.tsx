import { useState } from 'react'
import { Button, Input } from 'tamagui'
import { YStack } from '../shared/tamagui-typed.js'
import { useSignInEmailMutation } from '../../application/identity/sign-in.mutation.js'
import { ErrorState } from '../shared/error-state.js'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const signIn = useSignInEmailMutation()

  async function handleSubmit() {
    const result = await signIn.mutateAsync({ email, password })
    if (result.ok) onSuccess()
  }

  const error = signIn.error
    ? 'Une erreur est survenue lors de la connexion.'
    : signIn.data && !signIn.data.ok
      ? signIn.data.error.message
      : null

  return (
    <YStack gap="$3" padding="$4">
      <Input
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        testID="login-email"
      />
      <Input
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="login-password"
      />
      {error ? <ErrorState message={error} /> : null}
      <Button onPress={handleSubmit} disabled={signIn.isPending} testID="login-submit">
        {signIn.isPending ? 'Connexion...' : 'Se connecter'}
      </Button>
    </YStack>
  )
}
