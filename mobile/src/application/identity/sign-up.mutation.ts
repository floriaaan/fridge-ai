import { defineMutation } from '../shared/define-mutation.js'

export const useSignUpMutation = defineMutation(
  (connector, input: { email: string; password: string; name: string }) =>
    connector.signUpEmail(input.email, input.password, input.name),
)
