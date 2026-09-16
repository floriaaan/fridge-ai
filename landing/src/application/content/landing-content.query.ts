import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { useConnector } from '../shared/connector-context.js'
import type { LandingConnector } from '../../domain/interfaces/landing-connector.js'
import type { Locale } from '../../domain/content/landing-content.js'

export const landingContentQueryOptions = (connector: LandingConnector, locale: Locale) =>
  queryOptions({ queryKey: ['landing-content', locale], queryFn: () => connector.getContent(locale) })

export function useLandingContentQuery(locale: Locale) {
  return useSuspenseQuery(landingContentQueryOptions(useConnector(), locale))
}
