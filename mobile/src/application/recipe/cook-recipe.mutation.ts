import { defineMutation } from '../shared/define-mutation.js'

/**
 * "J'ai cuisiné."
 *
 * `productIds` are the garde-manger products the meal used up — sent from the
 * client because this is where the rapprochement between an ingredient and a
 * real product was made and confirmed by a person; the backend refuses to
 * guess it (`recipe-draft-parser.ts` will not invent a foreign key).
 */
export const useCookRecipeMutation = defineMutation(
  (connector, { recipeId, productIds }: { recipeId: string; productIds: string[] }) =>
    connector.cookRecipe(recipeId, productIds),
)
