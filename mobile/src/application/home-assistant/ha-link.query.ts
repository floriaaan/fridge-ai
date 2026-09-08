import { defineQuery } from '../shared/define-query.js'

export const useHaLinkQuery = defineQuery(['ha-link'], (connector) => connector.getHaLink())
