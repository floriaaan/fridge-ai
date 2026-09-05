import { defineMutation } from '../shared/define-mutation.js'

export const useLeaveHouseholdMutation = defineMutation((connector) => connector.leaveHousehold())
