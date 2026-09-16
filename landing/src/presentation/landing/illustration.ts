import type { IllustrationName } from '../../domain/content/landing-content.js'

export function illustrationSrc(name: IllustrationName): string {
  return `/illustrations/${name}-3d.png`
}
