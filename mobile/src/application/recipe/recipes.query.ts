import { defineQuery } from '../shared/define-query.js'

export const useRecipesQuery = defineQuery(['recipes'], (connector) => connector.getRecipes())
