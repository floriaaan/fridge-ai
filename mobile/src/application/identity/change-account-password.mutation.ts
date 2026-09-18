import { defineMutation } from '../shared/define-mutation.js'

export const useChangeAccountPasswordMutation = defineMutation(
  (connector, variables: { currentPassword: string; newPassword: string }) =>
    connector.changeAccountPassword(variables.currentPassword, variables.newPassword),
)
