import { useState } from 'react'
import { YStack } from '../shared/tamagui-typed.js'
import { useSignUpMutation } from '../../application/identity/sign-up.mutation.js'
import { AuthButton } from './auth-button.js'
import { AuthError } from './auth-error.js'
import { AuthField } from './auth-field.js'

export function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const signUp = useSignUpMutation()

  async function handleSubmit() {
    const result = await signUp.mutateAsync({ email, password, name })
    if (result.ok) onSuccess()
  }

  const error = signUp.error
    ? "Une erreur est survenue lors de l'inscription."
    : signUp.data && !signUp.data.ok
      ? signUp.data.error.message
      : null

  return (
    <YStack gap="$3">
      <AuthField label="Nom" placeholder="Ton prénom" value={name} onChangeText={setName} testID="signup-name" />
      <AuthField
        label="Email"
        placeholder="toi@exemple.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        testID="signup-email"
      />
      <AuthField
        label="Mot de passe"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="signup-password"
      />
      {error ? <AuthError message={error} /> : null}
      <AuthButton
        label="S'inscrire"
        pendingLabel="Inscription..."
        pending={signUp.isPending}
        onPress={handleSubmit}
        testID="signup-submit"
      />
    </YStack>
  )
}
