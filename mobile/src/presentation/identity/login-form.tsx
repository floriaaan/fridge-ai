import { useState } from 'react'
import { YStack } from '../shared/tamagui-typed.js'
import { useSoftPalette } from '../dashboard/soft-palette.js'
import { useSignInEmailMutation } from '../../application/identity/sign-in.mutation.js'
import { authErrorMessage } from './auth-error-message.js'
import { AuthButton } from './auth-button.js'
import { AuthError } from './auth-error.js'
import { AuthField } from './auth-field.js'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const palette = useSoftPalette()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const signIn = useSignInEmailMutation()

  const trimmedEmail = email.trim()
  // Not password.trim() — a leading/trailing space in a password can be
  // intentional and part of it; email whitespace from autofill/autocapitalize
  // is never meaningful and was a real source of confusing false-negative
  // logins.
  const canSubmit = trimmedEmail.length > 0 && password.length > 0

  async function handleSubmit() {
    if (!canSubmit) return
    const result = await signIn.mutateAsync({ email: trimmedEmail, password })
    if (result.ok) onSuccess()
  }

  const error = authErrorMessage(signIn.error, signIn.data, 'Une erreur est survenue lors de la connexion.')

  return (
    <YStack gap="$3">
      <AuthField
        label="Email"
        labelColor={palette.onDarkSecondary}
        placeholder="toi@exemple.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        testID="login-email"
      />
      <AuthField
        label="Mot de passe"
        labelColor={palette.onDarkSecondary}
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
        disabled={!canSubmit}
        onPress={handleSubmit}
        testID="login-submit"
      />
    </YStack>
  )
}
