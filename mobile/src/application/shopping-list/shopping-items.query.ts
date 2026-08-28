import { defineQuery } from '../shared/define-query.js'

export const useShoppingItemsQuery = defineQuery(['shopping-items'], (connector) => connector.getShoppingItems())
