import { queryOptions, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useConnector } from './connector-context.js'
import type { LandingConnector } from '../../domain/interfaces/landing-connector.js'

/**
 * One query, two entry points sharing the same key: `options(connector)` for a
 * route loader to prefetch during SSR (no React context there), `use()` for
 * components.
 */
export function defineQuery<TData>(
  queryKey: readonly unknown[],
  queryFn: (connector: LandingConnector) => Promise<TData>,
) {
  const options = (connector: LandingConnector) =>
    queryOptions({ queryKey, queryFn: () => queryFn(connector) })

  return {
    options,
    use: () => useQuery(options(useConnector())),
    useSuspense: () => useSuspenseQuery(options(useConnector())),
  }
}
