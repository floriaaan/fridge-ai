export const SITE_URL = 'https://gardemanger.floriaaan.fr'

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`
}
