import { defineQuery } from '../shared/define-query.js'

export const landingContentQuery = defineQuery(['landing-content'], (connector) =>
  connector.getContent(),
)

export const useLandingContentQuery = landingContentQuery.useSuspense
