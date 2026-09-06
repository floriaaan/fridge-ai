import { defineMutation } from '../shared/define-mutation.js'

export const useCreateHouseholdMutation = defineMutation((connector, name: string) =>
  connector.createHousehold(name),
)
