import { SvgXml } from 'react-native-svg'

/** Google Gemini's four-point sparkle mark, single-color path so it recolors via `color`. */
const GEMINI_SVG = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.304 14.304 0 0 0 12 12 14.304 14.304 0 0 0-12 12Z"/></svg>`

export function GeminiIcon({ size = 17, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return <SvgXml xml={GEMINI_SVG(color)} width={size} height={size} />
}
