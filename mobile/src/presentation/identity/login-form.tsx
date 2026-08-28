import { useState } from 'react'
import { YStack } from '../shared/tamagui-typed.js'
import { useSignInEmailMutation } from '../../application/identity/sign-in.mutation.js'
import { AuthButton, AuthError, AuthField } from './auth-ui.js'

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
    <YStack gap="$3">
      <AuthField
        label="Email"
        placeholder="toi@exemple.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        testID="login-email"
      />
      <AuthField
        label="Mot de passe"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="login-password"
      />
      {error ? <AuthError message={error} /> : null}
      <AuthButton
        label="Se connecter"
        pendingLabel="Connexion..."
        pending={signIn.isPending}
        onPress={handleSubmit}
        testID="login-submit"
      />
    </YStack>
  )
}
