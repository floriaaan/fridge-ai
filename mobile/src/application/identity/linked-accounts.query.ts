import { defineQuery } from '../shared/define-query.js'

export const useLinkedAccountsQuery = defineQuery(['linked-accounts'], (connector) =>
  connector.getLinkedAccounts(),
)
