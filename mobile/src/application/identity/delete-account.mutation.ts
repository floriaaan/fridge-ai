import { defineMutation } from '../shared/define-mutation.js'

export const useDeleteAccountMutation = defineMutation((connector, password: string) =>
  connector.deleteAccount(password),
)
