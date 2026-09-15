import { defineMutation } from '../shared/define-mutation.js'
import type { RecordProductOutcomeInput } from '../../domain/fridge/product-outcome.js'

export const useRecordProductOutcomeMutation = defineMutation(
  (connector, variables: { productId: string; input: RecordProductOutcomeInput }) =>
    connector.recordProductOutcome(variables.productId, variables.input),
)
