import { defineMutation } from '../shared/define-mutation.js'

export const useRemoveHouseholdMemberMutation = defineMutation((connector, userId: string) =>
  connector.removeHouseholdMember(userId),
)
