import { defineMutation } from '../shared/define-mutation.js'

export const useSyncShoppingListWithHaMutation = defineMutation((connector, _input: void) =>
  connector.syncShoppingListWithHa(),
)
