import { defineMutation } from '../shared/define-mutation.js'

export const useDeleteRecipeMutation = defineMutation((connector, recipeId: string) =>
  connector.deleteRecipe(recipeId),
)
