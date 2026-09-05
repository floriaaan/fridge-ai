import { useDomainQuery } from '../shared/use-domain-query.js'

export function useRecipeQuery(recipeId: string) {
  return useDomainQuery(['recipe', recipeId], (connector) => connector.getRecipe(recipeId), {
    enabled: recipeId.length > 0,
  })
}
