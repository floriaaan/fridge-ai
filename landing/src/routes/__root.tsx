/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import type { LandingConnector } from '../domain/interfaces/landing-connector.js'
import appCss from '../styles/app.css?url'

const TITLE = 'Garde-manger — le frigo partagé du foyer, auto-hébergé'
const DESCRIPTION =
  'Inventaire partagé, dates de péremption, scan de tickets et recettes avec ce qui reste. Open source et auto-hébergeable.'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  connector: LandingConnector
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'theme-color', content: '#E9F6D8' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:image', content: '/logo.png' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      { rel: 'apple-touch-icon', href: '/logo.png' },
    ],
  }),
  component: () => (
    <RootDocument>
      <Outlet />
    </RootDocument>
  ),
})

function RootDocument({ children }: { children: ReactNode }) {
  // The root layout wraps every route, so the locale comes from the URL
  // rather than from loader data (each locale is its own route: '/' is fr,
  // '/en' is en — cf. routes/index.tsx and routes/en.tsx).
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const lang = pathname.startsWith('/en') ? 'en' : 'fr'

  return (
    <html lang={lang}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
