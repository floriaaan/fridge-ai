/**
 * Authored SVG icons, one consistent stroke and weight (round cap/join,
 * strokeWidth 2, 24×24 viewBox) — the Lucide icon set's path data
 * (ISC-licensed), vendored directly against `react-native-svg` because
 * `@tamagui/lucide-icons-2` (2.7.7, the tamagui-2 rename of
 * `@tamagui/lucide-icons`) ships its icons without declaring
 * `react-native-svg` as a dependency of its own package.json, which pnpm's
 * strict node_modules linking makes unresolvable for Metro in this
 * monorepo. Drawing the icons this screen needs directly is a five-line
 * fix; depending on a package that cannot resolve its own runtime import is
 * not.
 */
import { Circle, Path, Polyline, Svg } from 'react-native-svg'

interface IconProps {
  size: number
  color: string
}

type IconSegment = { d?: string; cx?: string; cy?: string; r?: string; points?: string }

function icon(paths: IconSegment[]) {
  return function DashboardIcon({ size, color }: IconProps) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {paths.map((p, i) =>
          p.d ? (
            <Path key={i} d={p.d} stroke={color} />
          ) : p.points ? (
            <Polyline key={i} points={p.points} stroke={color} />
          ) : (
            <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} stroke={color} />
          ),
        )}
      </Svg>
    )
  }
}

export const CircleCheckIcon = icon([{ cx: '12', cy: '12', r: '10' }, { d: 'm9 12 2 2 4-4' }])
export const CircleXIcon = icon([{ cx: '12', cy: '12', r: '10' }, { d: 'm15 9-6 6' }, { d: 'm9 9 6 6' }])
export const TriangleAlertIcon = icon([
  { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' },
  { d: 'M12 9v4' },
  { d: 'M12 17h.01' },
])
export const ShoppingCartIcon = icon([
  { cx: '8', cy: '21', r: '1' },
  { cx: '19', cy: '21', r: '1' },
  { d: 'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12' },
])
export const ChefHatIcon = icon([
  {
    d: 'M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z',
  },
  { d: 'M6 17h12' },
])
export const FlameIcon = icon([
  {
    d: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  },
])
export const ScanLineIcon = icon([
  { d: 'M3 7V5a2 2 0 0 1 2-2h2' },
  { d: 'M17 3h2a2 2 0 0 1 2 2v2' },
  { d: 'M21 17v2a2 2 0 0 1-2 2h-2' },
  { d: 'M7 21H5a2 2 0 0 1-2-2v-2' },
  { d: 'M7 12h10' },
])
export const WalletIcon = icon([
  {
    d: 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1',
  },
  { d: 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4' },
])
export const PackageIcon = icon([
  {
    d: 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z',
  },
  { d: 'M12 22V12' },
  { points: '3.29 7 12 12 20.71 7' },
  { d: 'm7.5 4.27 9 5.15' },
])
export const TrendingUpIcon = icon([
  { points: '22 7 13.5 15.5 8.5 10.5 2 17' },
  { points: '16 7 22 7 22 13' },
])
export const LeafIcon = icon([
  { d: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z' },
  { d: 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12' },
])
