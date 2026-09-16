import { createFileRoute } from '@tanstack/react-router'
import { landingContentQueryOptions } from '../application/content/landing-content.query.js'
import { LandingPage } from '../presentation/landing/landing-page.js'

const TITLE = 'Garde-manger — the household’s shared pantry, self-hosted'
const DESCRIPTION =
  'Shared inventory, expiry dates, receipt scanning and recipes with what’s left. Open source and self-hostable.'

export const Route = createFileRoute('/en')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(landingContentQueryOptions(context.connector, 'en')),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
    ],
  }),
  component: () => <LandingPage locale="en" />,
})
