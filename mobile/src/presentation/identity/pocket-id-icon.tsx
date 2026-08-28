import { useColorScheme } from 'react-native'
import { SvgXml } from 'react-native-svg'

/**
 * Pocket ID's mark, from selfh.st/icons (github.com/selfhst/icons,
 * `svg/pocket-id.svg` + `svg/pocket-id-light.svg`) — CC BY 4.0, © the
 * selfh.st/icons maintainers. Inlined as raw SVG strings (no metro
 * SVG-to-component transformer is configured in this project) rather
 * than left as a generic auth-provider placeholder.
 *
 * Two variants, not one: the base mark is a solid black circle, which
 * reads fine on the light auth card but goes nearly invisible on the
 * near-black dark-mode card (a real bug caught by actually rendering
 * dark mode). `-light` is selfh.st's own white-only silhouette, made
 * for exactly this — dark surfaces — not a tint we invented.
 */
const POCKET_ID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256"/><path d="M268.6 102.4c64.4 0 116.8 52.4 116.8 116.7 0 25.3-8 49.4-23 69.6-14.8 19.9-35 34.3-58.4 41.7l-6.5 2-15.5-76.2 4.3-2c14-6.7 23-21.1 23-36.6 0-22.4-18.2-40.6-40.6-40.6S228 195.2 228 217.6c0 15.5 9 29.8 23 36.6l4.2 2-25 153.4h-69.5V102.4z" style="fill:#fff"/></svg>`

const POCKET_ID_SVG_ON_DARK = `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0m106.4 288.7c-14.8 19.9-35 34.3-58.4 41.7l-6.5 2-15.5-76.2 4.3-2c14-6.7 23-21.1 23-36.6 0-22.4-18.2-40.6-40.6-40.6S228 195.2 228 217.6c0 15.5 9 29.8 23 36.6l4.2 2-25 153.4h-69.5V102.4h107.9c64.4 0 116.8 52.4 116.8 116.7 0 25.3-8 49.4-23 69.6" style="fill:#fff"/></svg>`

export function PocketIdIcon({ size = 18 }: { size?: number }) {
  const scheme = useColorScheme()
  return <SvgXml xml={scheme === 'dark' ? POCKET_ID_SVG_ON_DARK : POCKET_ID_SVG} width={size} height={size} />
}
