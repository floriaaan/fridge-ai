import { defineMutation } from '../shared/define-mutation.js'

export const useJoinHouseholdMutation = defineMutation((connector, inviteCode: string) =>
  connector.joinHousehold(inviteCode),
)
