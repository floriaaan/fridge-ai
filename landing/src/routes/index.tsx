import { createFileRoute } from '@tanstack/react-router'
import { landingContentQueryOptions } from '../application/content/landing-content.query.js'
import { LandingPage } from '../presentation/landing/landing-page.js'

const TITLE = 'Garde-manger — le frigo partagé du foyer, auto-hébergé'
const DESCRIPTION =
  'Inventaire partagé, dates de péremption, scan de tickets et recettes avec ce qui reste. Open source et auto-hébergeable.'

export const Route = createFileRoute('/')({
  // Content is prefetched so it is in the server-rendered HTML; instance stats
  // and GitHub are read in the browser and never hold the page back.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(landingContentQueryOptions(context.connector, 'fr')),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
    ],
  }),
  component: () => <LandingPage locale="fr" />,
})
