import { defineMutation } from '../shared/define-mutation.js'
import type { CreateProductInput } from '../../domain/fridge/product.js'

export const useCreateProductMutation = defineMutation((connector, input: CreateProductInput) =>
  connector.createProduct(input),
)
