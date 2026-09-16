import type { Screenshot } from '../../domain/content/landing-content.js'
import { cn } from '../ui/cn.js'

/**
 * A CSS iPhone frame. Until real screenshots are provided it says so instead
 * of showing an invented screen (DESIGN.md: disclose placeholders honestly).
 */
export function PhoneMockup({ screenshot, className }: { screenshot: Screenshot | undefined; className?: string }) {
  return (
    <div className={cn('w-[190px] rotate-[-4deg] rounded-[2.4rem] bg-linear-to-br from-[#f4f4f2] via-[#c9c9c6] to-[#8e8e8b] p-[8px] shadow-hero-lift sm:w-[210px]', className)}>
      <div className="relative aspect-[9/19.5] overflow-hidden rounded-[1.9rem] bg-ground-white">
        <div aria-hidden className="absolute top-2 left-1/2 z-10 h-5 w-16 -translate-x-1/2 rounded-full bg-ink" />
        {screenshot ? (
          <img src={screenshot.src} alt={screenshot.alt} width={598} height={1300} className="size-full object-cover object-top" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-5 bg-linear-to-b from-ground-mint to-ground-white px-8 text-center">
            <img src="/logo.png" alt="" width={96} height={96} className="size-24 rounded-[26px] shadow-card-float" />
            <p className="text-lg font-extrabold text-ink">Garde-manger</p>
            <p className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-cream-text">
              Captures d’écran · bientôt
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
