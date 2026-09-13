import { SvgXml } from 'react-native-svg'

/**
 * Pocket ID's mark, from selfh.st/icons (github.com/selfhst/icons,
 * `svg/pocket-id-light.svg`) — CC BY 4.0, © the selfh.st/icons maintainers.
 * Inlined as a raw SVG string (no metro SVG-to-component transformer is
 * configured in this project) rather than left as a generic auth-provider
 * placeholder.
 *
 * The white silhouette only, not the solid-black-circle base mark
 * (`pocket-id.svg`) — its one caller, `AuthMethodFooter`'s PocketID button,
 * sits on the auth shell's `brandDeep` panel unconditionally now, not a
 * light card that only turns dark in dark mode. This used to switch on
 * `useColorScheme()` for exactly that light-card case; once the shell
 * itself became always-dark, the light-mode branch was drawing a
 * near-black circle on a near-black-ish mocha ground — a real bug caught
 * by actually rendering it, not just the dark-mode branch this file used
 * to only worry about.
 */
const POCKET_ID_SVG_ON_DARK = `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0m106.4 288.7c-14.8 19.9-35 34.3-58.4 41.7l-6.5 2-15.5-76.2 4.3-2c14-6.7 23-21.1 23-36.6 0-22.4-18.2-40.6-40.6-40.6S228 195.2 228 217.6c0 15.5 9 29.8 23 36.6l4.2 2-25 153.4h-69.5V102.4h107.9c64.4 0 116.8 52.4 116.8 116.7 0 25.3-8 49.4-23 69.6" style="fill:#fff"/></svg>`

export function PocketIdIcon({ size = 18 }: { size?: number }) {
  return <SvgXml xml={POCKET_ID_SVG_ON_DARK} width={size} height={size} />
}
