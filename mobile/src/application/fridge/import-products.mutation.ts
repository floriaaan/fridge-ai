import { defineMutation } from '../shared/define-mutation.js'
import type { ImportProductsItemInput } from '../../domain/fridge/fridge-scan-draft.js'

export const useImportProductsMutation = defineMutation((connector, items: ImportProductsItemInput[]) =>
  connector.importProducts(items),
)
