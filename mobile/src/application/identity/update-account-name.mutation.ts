import { defineMutation } from '../shared/define-mutation.js'

export const useUpdateAccountNameMutation = defineMutation((connector, name: string) =>
  connector.updateAccountName(name),
)
