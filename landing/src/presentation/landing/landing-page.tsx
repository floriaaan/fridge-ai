import { useLandingContentQuery } from '../../application/content/landing-content.query.js'
import { FaqSection } from './faq-section.js'
import { Hero } from './hero.js'
import { OffersSection } from './offers-section.js'
import { SiteFooter } from './site-footer.js'
import { SiteHeader } from './site-header.js'
import { StatsSection } from './stats-section.js'

export function LandingPage() {
  const { data: content } = useLandingContentQuery()

  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Aller au contenu
      </a>
      <SiteHeader />
      <main id="contenu">
        <Hero content={content} />
        <StatsSection />
        <OffersSection content={content} />
        <FaqSection faq={content.faq} repositoryUrl={content.repositoryUrl} />
      </main>
      <SiteFooter repositoryUrl={content.repositoryUrl} />
    </>
  )
}
