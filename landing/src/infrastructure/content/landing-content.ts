import type { Locale } from '../../domain/content/landing-content.js'
import { landingContentFr } from './landing-content.fr.js'
import { landingContentEn } from './landing-content.en.js'

export const LANDING_CONTENT: Record<Locale, typeof landingContentFr> = {
  fr: landingContentFr,
  en: landingContentEn,
}
