import { defineMutation } from '../shared/define-mutation.js'

export const useTransferHouseholdOwnershipMutation = defineMutation((connector, newOwnerId: string) =>
  connector.transferHouseholdOwnership(newOwnerId),
)
