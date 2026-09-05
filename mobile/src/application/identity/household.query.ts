import { defineQuery } from '../shared/define-query.js'

export const useHouseholdQuery = defineQuery(['household'], (connector) => connector.getHousehold())
