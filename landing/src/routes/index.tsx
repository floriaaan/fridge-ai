import { createFileRoute } from '@tanstack/react-router'
import { landingContentQueryOptions } from '../application/content/landing-content.query.js'
import { LandingPage } from '../presentation/landing/landing-page.js'
import { absoluteUrl } from '../lib/seo.js'
import { faqJsonLd } from '../lib/faq-json-ld.js'

const TITLE = 'Garde-manger — le frigo partagé du foyer, auto-hébergé'
const DESCRIPTION =
  'Inventaire partagé, dates de péremption, scan de tickets et recettes avec ce qui reste. Open source et auto-hébergeable.'

export const Route = createFileRoute('/')({
  // Content is prefetched so it is in the server-rendered HTML; instance stats
  // and GitHub are read in the browser and never hold the page back.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(landingContentQueryOptions(context.connector, 'fr')),
  head: ({ loaderData }) => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: absoluteUrl('/') },
      ...(loaderData ? [{ 'script:ld+json': faqJsonLd(loaderData.faq) }] : []),
    ],
    links: [
      { rel: 'canonical', href: absoluteUrl('/') },
      { rel: 'alternate', hrefLang: 'fr', href: absoluteUrl('/') },
      { rel: 'alternate', hrefLang: 'en', href: absoluteUrl('/en') },
      { rel: 'alternate', hrefLang: 'x-default', href: absoluteUrl('/') },
    ],
  }),
  component: () => <LandingPage locale="fr" />,
})
