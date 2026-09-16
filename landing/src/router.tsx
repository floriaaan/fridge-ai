import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import { ConnectorProvider } from './application/shared/connector-context.js'
import { createConnector } from '../providers/create-connector.js'

export function getRouter() {
  const queryClient = new QueryClient({
    // A visit reads each source once; GitHub rate-limits anonymous callers.
    defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } },
  })
  const connector = createConnector()

  const router = createRouter({
    routeTree,
    context: { queryClient, connector },
    defaultPreload: 'intent',
    scrollRestoration: true,
    Wrap: ({ children }) => <ConnectorProvider connector={connector}>{children}</ConnectorProvider>,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
