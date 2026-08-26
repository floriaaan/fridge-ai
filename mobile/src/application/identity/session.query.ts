import { defineQuery } from '../shared/define-query.js'

export const useSessionQuery = defineQuery(['session'], (connector) => connector.getSession())
