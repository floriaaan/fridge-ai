export type IllustrationName = 'receipt' | 'pot-of-food' | 'shopping-cart' | 'carrot' | 'chart-increasing'

export interface Feature {
  id: string
  title: string
  description: string
  illustration: IllustrationName
}

export interface Screenshot {
  src: string
  alt: string
}

export interface Offer {
  /** Short name of the way to use the app, e.g. "Clé en main". */
  label: string
  tag: string
  title: string
  description: string
  perks: string[]
  /** `href: null` while the offer isn't open — rendered as a disabled "bientôt" pill. */
  cta: { label: string; href: string | null }
}

export interface HostedOffer extends Offer {
  /** Free core first, then the AI subscription. No prices until pricing is decided. */
  tiers: { name: string; description: string }[]
}

export interface SelfHostedOffer extends Offer {
  commands: string[]
}

export interface FaqEntry {
  question: string
  answer: string
}

export interface StoreLinks {
  /** `null` until the app is published — rendered as a disabled "bientôt" badge. */
  appStore: string | null
  playStore: string | null
}

export interface LandingContent {
  repositoryUrl: string
  hero: {
    eyebrow: string
    /** The headline is split so the presentation can circle the middle part. */
    titleBefore: string
    titleHighlight: string
    titleAfter: string
    subtitle: string
    /** Front phone first, a second one peeks behind it. Empty = an honest placeholder. */
    screenshots: Screenshot[]
  }
  features: Feature[]
  /** The two ways to use the app — hosted first and larger. */
  offers: {
    /** Split like the hero headline so the presentation can underline the first part. */
    titleHighlight: string
    titleAfter: string
    subtitle: string
    hosted: HostedOffer
    selfHosted: SelfHostedOffer
  }
  faq: FaqEntry[]
  stores: StoreLinks
}
