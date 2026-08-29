import { defineMutation } from '../shared/define-mutation.js'
import type { CreateShoppingItemInput } from '../../domain/shopping-list/shopping-item.js'

export const useCreateShoppingItemMutation = defineMutation((connector, input: CreateShoppingItemInput) =>
  connector.createShoppingItem(input),
)
