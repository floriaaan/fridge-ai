import { defineMutation } from '../shared/define-mutation.js'

export const useToggleShoppingItemMutation = defineMutation(
  (connector, variables: { itemId: string; checked: boolean }) =>
    connector.toggleShoppingItem(variables.itemId, variables.checked),
)
