import { useLandingContentQuery } from '../../application/content/landing-content.query.js'
import type { Locale } from '../../domain/content/landing-content.js'
import { FaqSection } from './faq-section.js'
import { Hero } from './hero.js'
import { OffersSection } from './offers-section.js'
import { SiteFooter } from './site-footer.js'
import { SiteHeader } from './site-header.js'
import { StatsSection } from './stats-section.js'

export function LandingPage({ locale }: { locale: Locale }) {
  const { data: content } = useLandingContentQuery(locale)

  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {content.ui.skipToContent}
      </a>
      <SiteHeader content={content} />
      <main id="contenu">
        <Hero content={content} />
        <StatsSection content={content} />
        <OffersSection content={content} />
        <FaqSection content={content} />
      </main>
      <SiteFooter content={content} />
    </>
  )
}
