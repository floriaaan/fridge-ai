import { defineQuery } from '../shared/define-query.js'

export const useAuthMethodsQuery = defineQuery(['auth-methods'], (connector) =>
  connector.getAuthMethods(),
)
