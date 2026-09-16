import { createFileRoute } from '@tanstack/react-router'
import { landingContentQueryOptions } from '../application/content/landing-content.query.js'
import { LandingPage } from '../presentation/landing/landing-page.js'
import { absoluteUrl } from '../lib/seo.js'
import { faqJsonLd } from '../lib/faq-json-ld.js'

const TITLE = 'Garde-manger — the household’s shared pantry, self-hosted'
const DESCRIPTION =
  'Shared inventory, expiry dates, receipt scanning and recipes with what’s left. Open source and self-hostable.'

export const Route = createFileRoute('/en')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(landingContentQueryOptions(context.connector, 'en')),
  head: ({ loaderData }) => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: absoluteUrl('/en') },
      ...(loaderData ? [{ 'script:ld+json': faqJsonLd(loaderData.faq) }] : []),
    ],
    links: [
      { rel: 'canonical', href: absoluteUrl('/en') },
      { rel: 'alternate', hrefLang: 'fr', href: absoluteUrl('/') },
      { rel: 'alternate', hrefLang: 'en', href: absoluteUrl('/en') },
      { rel: 'alternate', hrefLang: 'x-default', href: absoluteUrl('/') },
    ],
  }),
  component: () => <LandingPage locale="en" />,
})
