/**
 * `LinearGradient`'s `colors` prop takes raw color strings, not palette
 * tokens — a gradient stop that needs a *specific alpha* (fading a token to
 * transparent, say) has nowhere to express that through the palette object
 * itself. This turns a committed hex token into an rgba string with the
 * alpha the call site actually needs, so the gradient still traces back to
 * a real token instead of a hand-transcribed rgb triplet nobody can grep
 * for when that token's value changes.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!match) return hex
  const int = parseInt(match[1], 16)
  const r = (int >> 16) & 0xff
  const g = (int >> 8) & 0xff
  const b = int & 0xff
  return `rgba(${r},${g},${b},${alpha})`
}
