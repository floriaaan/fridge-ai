import { useState } from 'react'
import { Button, Input } from 'tamagui'
import { YStack } from '../shared/tamagui-typed.js'
import { useSignUpMutation } from '../../application/identity/sign-up.mutation.js'
import { ErrorState } from '../shared/error-state.js'

export function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const signUp = useSignUpMutation()

  async function handleSubmit() {
    const result = await signUp.mutateAsync({ email, password, name })
    if (result.ok) onSuccess()
  }

  const error = signUp.data && !signUp.data.ok ? signUp.data.error.message : null

  return (
    <YStack gap="$3" padding="$4">
      <Input placeholder="Nom" value={name} onChangeText={setName} testID="signup-name" />
      <Input
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        testID="signup-email"
      />
      <Input
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="signup-password"
      />
      {error ? <ErrorState message={error} /> : null}
      <Button onPress={handleSubmit} disabled={signUp.isPending} testID="signup-submit">
        {signUp.isPending ? 'Inscription...' : "S'inscrire"}
      </Button>
    </YStack>
  )
}
