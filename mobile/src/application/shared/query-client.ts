import { QueryClient } from '@tanstack/react-query'

/**
 * One instance, module-level rather than built inside `RootLayout`'s
 * `useState` — the plain-module HTTP layer (`http-client.ts`) needs to reach
 * the query cache too. On a 401 from the backend it flips the cached
 * `session` query straight to "signed out" (see `handleUnauthenticated`
 * there) instead of leaving every gate and every screen running on the
 * stale, still-truthy session from the last successful check: a
 * `QueryClient` built inside a component never existed anywhere
 * `http-client.ts` could import it from.
 */
export const queryClient = new QueryClient()
