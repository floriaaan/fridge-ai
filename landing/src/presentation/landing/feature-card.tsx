import type { Feature } from '../../domain/content/landing-content.js'
import { cn } from '../ui/cn.js'
import { CORNERS, type CornerSet } from '../ui/corners.js'
import { illustrationSrc } from './illustration.js'

export function FeatureCard({ feature, corners }: { feature: Feature; corners: CornerSet }) {
  return (
    <article
      className={cn(
        CORNERS[corners],
        'h-full bg-ground-white p-5 shadow-card-float transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1',
      )}
    >
      <div className="flex items-center gap-3">
        <img src={illustrationSrc(feature.illustration)} alt="" width={44} height={44} className="size-11 shrink-0" />
        <h3 className="text-[17px] leading-snug font-extrabold tracking-tight text-ink">{feature.title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{feature.description}</p>
    </article>
  )
}
