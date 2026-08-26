import { defineMutation } from '../shared/define-mutation.js'

export const useSignInEmailMutation = defineMutation(
  (connector, input: { email: string; password: string }) =>
    connector.signInEmail(input.email, input.password),
)

export const useSignInSocialMutation = defineMutation(
  (connector, input: { provider: 'pocketid' }) => connector.signInSocial(input.provider),
)
