import { defineQuery } from '../shared/define-query.js'

export const instanceStatsQuery = defineQuery(['instance-stats'], (connector) =>
  connector.getInstanceStats(),
)

export const useInstanceStatsQuery = instanceStatsQuery.use
