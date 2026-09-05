import { defineMutation } from '../shared/define-mutation.js'

export const useGenerateRecipesMutation = defineMutation((connector, prompt: string | undefined) =>
  connector.generateRecipes(prompt),
)
